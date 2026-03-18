import { and, eq, sql } from "drizzle-orm";
import type {
  ExternalConversationBinding,
  MessagingConnection
} from "@computer-oss/protocol";
import type { DatabaseClient } from "../client";
import {
  messagingConnections,
  messagingConversationBindings,
  outcomes,
  workspaces
} from "../schema";

type MessagingConnectionRow = typeof messagingConnections.$inferSelect;
type MessagingConversationBindingRow =
  typeof messagingConversationBindings.$inferSelect;

export type StoredMessagingConnection = MessagingConnection;
export type StoredExternalConversationBinding = ExternalConversationBinding;

export type UpsertMessagingConnectionInput = StoredMessagingConnection;
export type BindConversationInput = StoredExternalConversationBinding;
export type GetBindingByExternalConversationInput = {
  workspaceId: string;
  channel: StoredExternalConversationBinding["channel"];
  externalWorkspaceId: string;
  conversationId: string;
  threadId: string | null;
};

function workspaceName(id: string) {
  return `Workspace ${id}`;
}

function threadKey(threadId: string | null) {
  return threadId ?? "";
}

function conversationKey(input: {
  channel: string;
  externalWorkspaceId: string;
  conversationId: string;
  threadId: string | null;
}) {
  return `${input.channel}:${input.externalWorkspaceId}:${input.conversationId}:${input.threadId ?? ""}`;
}

function compareConnections(left: StoredMessagingConnection, right: StoredMessagingConnection) {
  if (left.channel !== right.channel) {
    return left.channel.localeCompare(right.channel);
  }

  const updatedDelta =
    new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();

  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return left.id.localeCompare(right.id);
}

function mapConnectionRow(row: MessagingConnectionRow): StoredMessagingConnection {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    channel: row.channel,
    transport: row.transport,
    status: row.status,
    enabled: row.enabled,
    accountLabel: row.accountLabel,
    externalWorkspaceId: row.externalWorkspaceId,
    externalWorkspaceLabel: row.externalWorkspaceLabel ?? null,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    lastInboundAt: row.lastInboundAt?.toISOString() ?? null,
    lastOutboundAt: row.lastOutboundAt?.toISOString() ?? null,
    lastError: row.lastError ?? null,
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapBindingRow(
  row: MessagingConversationBindingRow
): StoredExternalConversationBinding {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    outcomeId: row.outcomeId,
    channel: row.channel,
    connectionId: row.connectionId,
    externalWorkspaceId: row.externalWorkspaceId,
    conversationId: row.conversationId,
    threadId: row.threadId ?? null,
    lastInboundMessageId: row.lastInboundMessageId ?? null,
    lastOutboundDeliveryId: row.lastOutboundDeliveryId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

async function ensureWorkspace(db: DatabaseClient, workspaceId: string) {
  await db
    .insert(workspaces)
    .values({
      id: workspaceId,
      name: workspaceName(workspaceId)
    })
    .onConflictDoNothing();
}

export class MessagingRepository {
  constructor(private readonly db: DatabaseClient) {}

  async upsertConnection(
    input: UpsertMessagingConnectionInput
  ): Promise<StoredMessagingConnection> {
    return this.db.transaction(async (transaction) => {
      await ensureWorkspace(transaction, input.workspaceId);

      const [connectionRows, bindingRows] = await Promise.all([
        transaction.select().from(messagingConnections),
        transaction.select().from(messagingConversationBindings)
      ]);
      const existing = connectionRows.find(
        (row) =>
          row.workspaceId === input.workspaceId && row.channel === input.channel
      );

      if (!existing) {
        const [created] = await transaction
          .insert(messagingConnections)
          .values({
            id: input.id,
            workspaceId: input.workspaceId,
            channel: input.channel,
            transport: input.transport,
            status: input.status,
            enabled: input.enabled,
            accountLabel: input.accountLabel,
            externalWorkspaceId: input.externalWorkspaceId,
            externalWorkspaceLabel: input.externalWorkspaceLabel,
            connectedAt: input.connectedAt ? new Date(input.connectedAt) : null,
            lastInboundAt: input.lastInboundAt ? new Date(input.lastInboundAt) : null,
            lastOutboundAt: input.lastOutboundAt ? new Date(input.lastOutboundAt) : null,
            lastError: input.lastError,
            updatedAt: new Date(input.updatedAt)
          })
          .returning();

        return mapConnectionRow(created);
      }

      const hasBindings = bindingRows.some(
        (row) => row.connectionId === existing.id
      );

      if (
        existing.externalWorkspaceId !== input.externalWorkspaceId &&
        hasBindings
      ) {
        throw new Error(
          `Messaging connection ${existing.id} cannot switch external workspace from ${existing.externalWorkspaceId} to ${input.externalWorkspaceId} while bindings still reference it.`
        );
      }

      const whereClause =
        existing.externalWorkspaceId === input.externalWorkspaceId
          ? eq(messagingConnections.id, existing.id)
          : and(
              eq(messagingConnections.id, existing.id),
              and(
                eq(
                  messagingConnections.externalWorkspaceId,
                  existing.externalWorkspaceId
                ),
                sql`not exists (select 1 from ${messagingConversationBindings} where ${messagingConversationBindings.connectionId} = ${existing.id})`
              )
            );

      const [updated] = await transaction
        .update(messagingConnections)
        .set({
          transport: input.transport,
          status: input.status,
          enabled: input.enabled,
          accountLabel: input.accountLabel,
          externalWorkspaceId: input.externalWorkspaceId,
          externalWorkspaceLabel: input.externalWorkspaceLabel,
          connectedAt: input.connectedAt ? new Date(input.connectedAt) : null,
          lastInboundAt: input.lastInboundAt ? new Date(input.lastInboundAt) : null,
          lastOutboundAt: input.lastOutboundAt ? new Date(input.lastOutboundAt) : null,
          lastError: input.lastError,
          updatedAt: new Date(input.updatedAt)
        })
        .where(whereClause)
        .returning();

      if (!updated && existing.externalWorkspaceId !== input.externalWorkspaceId) {
        const [refreshedConnections, refreshedBindings] = await Promise.all([
          transaction.select().from(messagingConnections),
          transaction.select().from(messagingConversationBindings)
        ]);
        const current = refreshedConnections.find((row) => row.id === existing.id);

        if (!current) {
          throw new Error(`Messaging connection ${existing.id} does not exist.`);
        }

        if (
          refreshedBindings.some((row) => row.connectionId === current.id) &&
          current.externalWorkspaceId !== input.externalWorkspaceId
        ) {
          throw new Error(
            `Messaging connection ${current.id} cannot switch external workspace from ${current.externalWorkspaceId} to ${input.externalWorkspaceId} while bindings still reference it.`
          );
        }

        return mapConnectionRow(current);
      }

      return mapConnectionRow(updated);
    });
  }

  async getConnectionById(id: string): Promise<StoredMessagingConnection | null> {
    const rows = await this.db.select().from(messagingConnections);
    const found = rows.find((row) => row.id === id);
    return found ? mapConnectionRow(found) : null;
  }

  async listConnectionsByWorkspace(
    workspaceId: string
  ): Promise<StoredMessagingConnection[]> {
    const rows = await this.db.select().from(messagingConnections);
    return rows
      .filter((row) => row.workspaceId === workspaceId)
      .map(mapConnectionRow)
      .sort(compareConnections);
  }

  async bindConversation(
    input: BindConversationInput
  ): Promise<StoredExternalConversationBinding> {
    return this.db.transaction(async (transaction) => {
      const [connectionRows, outcomeRows, bindingRows] = await Promise.all([
        transaction.select().from(messagingConnections),
        transaction.select().from(outcomes),
        transaction.select().from(messagingConversationBindings)
      ]);

      const connection = connectionRows.find((row) => row.id === input.connectionId);

      if (!connection) {
        throw new Error(`Messaging connection ${input.connectionId} does not exist.`);
      }

      if (
        connection.workspaceId !== input.workspaceId ||
        connection.channel !== input.channel
      ) {
        throw new Error(
          `Messaging connection ${input.connectionId} does not belong to ${input.workspaceId}/${input.channel}.`
        );
      }

      if (connection.externalWorkspaceId !== input.externalWorkspaceId) {
        throw new Error(
          `Messaging connection ${input.connectionId} is authenticated to external workspace ${connection.externalWorkspaceId}, not ${input.externalWorkspaceId}.`
        );
      }

      const outcome = outcomeRows.find((row) => row.id === input.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${input.outcomeId} does not exist.`);
      }

      if (outcome.workspaceId !== input.workspaceId) {
        throw new Error(
          `Outcome ${input.outcomeId} belongs to ${outcome.workspaceId}, not ${input.workspaceId}.`
        );
      }

      const existing = bindingRows.find(
        (row) =>
          row.workspaceId === input.workspaceId &&
          row.channel === input.channel &&
          row.externalWorkspaceId === input.externalWorkspaceId &&
          row.conversationId === input.conversationId &&
          row.threadKey === threadKey(input.threadId)
      );

      if (existing && existing.outcomeId !== input.outcomeId) {
        throw new Error(
          `Conversation ${conversationKey(input)} is already bound to outcome ${existing.outcomeId}.`
        );
      }

      if (existing) {
        const [updated] = await transaction
          .update(messagingConversationBindings)
          .set({
            connectionId: input.connectionId,
            lastInboundMessageId: input.lastInboundMessageId,
            lastOutboundDeliveryId: input.lastOutboundDeliveryId,
            updatedAt: new Date(input.updatedAt)
          })
          .where(eq(messagingConversationBindings.id, existing.id))
          .returning();

        return mapBindingRow(updated);
      }

      const [created] = await transaction
        .insert(messagingConversationBindings)
        .values({
          id: input.id,
          workspaceId: input.workspaceId,
          outcomeId: input.outcomeId,
          channel: input.channel,
          connectionId: input.connectionId,
          externalWorkspaceId: input.externalWorkspaceId,
          conversationId: input.conversationId,
          threadId: input.threadId,
          threadKey: threadKey(input.threadId),
          lastInboundMessageId: input.lastInboundMessageId,
          lastOutboundDeliveryId: input.lastOutboundDeliveryId,
          createdAt: new Date(input.createdAt),
          updatedAt: new Date(input.updatedAt)
        })
        .returning();

      return mapBindingRow(created);
    });
  }

  async getBindingByExternalConversation(
    input: GetBindingByExternalConversationInput
  ): Promise<StoredExternalConversationBinding | null> {
    const rows = await this.db.select().from(messagingConversationBindings);
    const found = rows.find(
      (row) =>
        row.workspaceId === input.workspaceId &&
        row.channel === input.channel &&
        row.externalWorkspaceId === input.externalWorkspaceId &&
        row.conversationId === input.conversationId &&
        row.threadKey === threadKey(input.threadId)
    );

    return found ? mapBindingRow(found) : null;
  }
}
