import { createHash } from "node:crypto";
import {
  MessagingConnectionSchema,
  MessagingDeliverySchema,
  MessagingInboundMessageSchema,
  type ExternalConversationBinding,
  type MessagingChannel,
  type MessagingConnection,
  type MessagingConnectionStatus,
  type MessagingDelivery,
  type MessagingDeliveryKind,
  type MessagingInboundMessage,
  type MessagingTransport
} from "@computer-oss/protocol";
import type { EventBus } from "./event-bus";
import type { Repositories } from "./repositories";

export type DeliveryDispatchResult = {
  externalDeliveryId?: string;
};

export type ChannelTransportAdapter = {
  transport: MessagingTransport;
  deliver(delivery: MessagingDelivery): Promise<DeliveryDispatchResult | void>;
};

type MessagingServiceOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  adapters: Record<MessagingChannel, ChannelTransportAdapter>;
  now?: () => Date;
};

type UpsertConnectionRequest = {
  workspaceId: string;
  channel: MessagingChannel;
  enabled: boolean;
  accountLabel: string;
  externalWorkspaceId: string;
  externalWorkspaceLabel?: string | null;
};

type DeliverToOutcomeRequest = {
  outcomeId: string;
  kind: MessagingDeliveryKind;
  body: string;
  runId: string | null;
};

type OutcomeMessageHistory = {
  connection: MessagingConnection | null;
  bindings: ExternalConversationBinding[];
  deliveries: MessagingDelivery[];
};

type InboundHandleResult = {
  accepted: true;
  outcomeId: string;
  created: boolean;
  duplicate: boolean;
};

export type MessagingService = {
  getConnection(
    workspaceId: string,
    channel: MessagingChannel
  ): Promise<MessagingConnection | null>;
  upsertConnection(input: UpsertConnectionRequest): Promise<MessagingConnection>;
  handleInboundMessage(input: MessagingInboundMessage): Promise<InboundHandleResult>;
  deliverToOutcome(input: DeliverToOutcomeRequest): Promise<MessagingDelivery>;
  getOutcomeHistory(outcomeId: string): Promise<OutcomeMessageHistory>;
  close(): void;
};

function deterministicId(prefix: string, seed: string) {
  const suffix = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  return `${prefix}_${suffix}`;
}

function inboundConversationKey(input: {
  channel: MessagingChannel;
  externalWorkspaceId: string;
  conversationId: string;
  threadId: string | null;
}) {
  return `${input.channel}:${input.externalWorkspaceId}:${input.conversationId}:${input.threadId ?? ""}`;
}

function compareBindingsNewestFirst(
  left: ExternalConversationBinding,
  right: ExternalConversationBinding
) {
  const updatedDelta =
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();

  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return right.id.localeCompare(left.id);
}

async function createOrReuseOutcome(
  repositories: Repositories,
  message: MessagingInboundMessage,
  outcomeId: string
) {
  try {
    const created = await repositories.outcomes.create({
      id: outcomeId,
      workspaceId: message.workspaceId,
      userId: `${message.channel}_user_${message.senderId}`,
      prompt: message.text,
      source: message.channel
    });

    return { outcome: created, created: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate")) {
      const existing = await repositories.outcomes.getById(outcomeId);

      if (existing) {
        return { outcome: existing, created: false };
      }
    }

    throw error;
  }
}

async function appendInboundMessage(
  repositories: Repositories,
  message: MessagingInboundMessage,
  outcomeId: string
) {
  const appendedMessage = {
    id: deterministicId("msg", message.dedupeKey),
    outcomeId,
    role: "user" as const,
    content: message.text,
    createdAt: message.receivedAt
  };

  try {
    await repositories.outcomes.appendMessage(appendedMessage);
    return { appended: true, message: appendedMessage };
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate")) {
      return { appended: false, message: appendedMessage };
    }

    throw error;
  }
}

export function createMessagingService(
  options: MessagingServiceOptions
): MessagingService {
  const now = options.now ?? (() => new Date());
  const deliveriesByOutcome = new Map<string, MessagingDelivery[]>();

  async function findConnection(
    workspaceId: string,
    channel: MessagingChannel
  ): Promise<MessagingConnection | null> {
    const connections = await options.repositories.messaging.listConnectionsByWorkspace(
      workspaceId
    );

    return connections.find((connection) => connection.channel === channel) ?? null;
  }

  async function persistConnectionState(
    existing: MessagingConnection,
    input: {
      status?: MessagingConnectionStatus;
      lastInboundAt?: string | null;
      lastOutboundAt?: string | null;
      lastError?: string | null;
      outcomeId?: string;
    }
  ) {
    const updated = MessagingConnectionSchema.parse(
      await options.repositories.messaging.upsertConnection({
        ...existing,
        status: input.status ?? existing.status,
        lastInboundAt:
          input.lastInboundAt !== undefined ? input.lastInboundAt : existing.lastInboundAt,
        lastOutboundAt:
          input.lastOutboundAt !== undefined
            ? input.lastOutboundAt
            : existing.lastOutboundAt,
        lastError: input.lastError !== undefined ? input.lastError : existing.lastError,
        updatedAt: now().toISOString()
      })
    );

    if (input.outcomeId) {
      options.eventBus.publish({
        outcomeId: input.outcomeId,
        type: "messaging.connection.updated",
        data: updated
      });
    }

    return updated;
  }

  async function recordDelivery(
    binding: ExternalConversationBinding,
    connection: MessagingConnection,
    input: DeliverToOutcomeRequest
  ) {
    const adapter = options.adapters[binding.channel];
    const attemptedAt = now().toISOString();
    const deliveryId = deterministicId(
      "delivery",
      `${binding.id}:${input.kind}:${input.runId ?? ""}:${input.body}:${attemptedAt}`
    );

    try {
      const draft = MessagingDeliverySchema.parse({
        id: deliveryId,
        workspaceId: binding.workspaceId,
        connectionId: binding.connectionId,
        channel: binding.channel,
        externalWorkspaceId: binding.externalWorkspaceId,
        conversationId: binding.conversationId,
        threadId: binding.threadId,
        kind: input.kind,
        status: "pending",
        body: input.body,
        outcomeId: input.outcomeId,
        runId: input.runId,
        sentAt: null,
        lastAttemptAt: attemptedAt,
        errorMessage: null
      });

      await adapter.deliver(draft);

      const sent = MessagingDeliverySchema.parse({
        ...draft,
        status: "sent",
        sentAt: attemptedAt,
        lastAttemptAt: attemptedAt
      });

      const deliveries = deliveriesByOutcome.get(input.outcomeId) ?? [];
      deliveries.push(sent);
      deliveriesByOutcome.set(input.outcomeId, deliveries);

      await options.repositories.messaging.bindConversation({
        ...binding,
        lastOutboundDeliveryId: sent.id,
        updatedAt: attemptedAt
      });
      await persistConnectionState(connection, {
        lastOutboundAt: attemptedAt,
        lastError: null,
        outcomeId: input.outcomeId
      });

      options.eventBus.publish({
        outcomeId: input.outcomeId,
        type: "messaging.delivery.updated",
        data: sent
      });

      return sent;
    } catch (error) {
      const failed = MessagingDeliverySchema.parse({
        id: deliveryId,
        workspaceId: binding.workspaceId,
        connectionId: binding.connectionId,
        channel: binding.channel,
        externalWorkspaceId: binding.externalWorkspaceId,
        conversationId: binding.conversationId,
        threadId: binding.threadId,
        kind: input.kind,
        status: "failed",
        body: input.body,
        outcomeId: input.outcomeId,
        runId: input.runId,
        sentAt: null,
        lastAttemptAt: attemptedAt,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      const deliveries = deliveriesByOutcome.get(input.outcomeId) ?? [];
      deliveries.push(failed);
      deliveriesByOutcome.set(input.outcomeId, deliveries);

      await persistConnectionState(connection, {
        lastError: failed.errorMessage,
        outcomeId: input.outcomeId
      });

      options.eventBus.publish({
        outcomeId: input.outcomeId,
        type: "messaging.delivery.updated",
        data: failed
      });

      return failed;
    }
  }

  return {
    async getConnection(workspaceId, channel) {
      return findConnection(workspaceId, channel);
    },
    async upsertConnection(input) {
      const existing = await findConnection(input.workspaceId, input.channel);
      const timestamp = now().toISOString();
      const status = input.enabled ? "connected" : "disabled";

      return MessagingConnectionSchema.parse(
        await options.repositories.messaging.upsertConnection({
          id:
            existing?.id ??
            deterministicId("connection", `${input.workspaceId}:${input.channel}`),
          workspaceId: input.workspaceId,
          channel: input.channel,
          transport: options.adapters[input.channel].transport,
          status,
          enabled: input.enabled,
          accountLabel: input.accountLabel,
          externalWorkspaceId: input.externalWorkspaceId,
          externalWorkspaceLabel: input.externalWorkspaceLabel ?? null,
          connectedAt:
            status === "connected" ? existing?.connectedAt ?? timestamp : null,
          lastInboundAt: existing?.lastInboundAt ?? null,
          lastOutboundAt: existing?.lastOutboundAt ?? null,
          lastError: status === "connected" ? null : existing?.lastError ?? null,
          updatedAt: timestamp
        })
      );
    },
    async handleInboundMessage(input) {
      const message = MessagingInboundMessageSchema.parse(input);
      const connection = await options.repositories.messaging.getConnectionById(
        message.connectionId
      );

      if (!connection || connection.workspaceId !== message.workspaceId) {
        throw new Error(
          `Messaging connection ${message.connectionId} does not exist for workspace ${message.workspaceId}.`
        );
      }

      if (!connection.enabled || connection.status === "disabled") {
        throw new Error(`Messaging connection ${message.connectionId} is disabled.`);
      }

      if (connection.externalWorkspaceId !== message.externalWorkspaceId) {
        throw new Error(
          `Messaging connection ${message.connectionId} is authenticated to external workspace ${connection.externalWorkspaceId}, not ${message.externalWorkspaceId}.`
        );
      }

      const existingBinding =
        await options.repositories.messaging.getBindingByExternalConversation({
          workspaceId: message.workspaceId,
          channel: message.channel,
          externalWorkspaceId: message.externalWorkspaceId,
          conversationId: message.conversationId,
          threadId: message.threadId
        });

      if (
        existingBinding &&
        existingBinding.lastInboundMessageId === message.externalMessageId &&
        existingBinding.lastOutboundDeliveryId
      ) {
        return {
          accepted: true,
          outcomeId: existingBinding.outcomeId,
          created: false,
          duplicate: true
        };
      }

      const outcomeId =
        existingBinding?.outcomeId ??
        deterministicId("outcome", message.dedupeKey);
      const { outcome, created } = await createOrReuseOutcome(
        options.repositories,
        message,
        outcomeId
      );

      if (created) {
        options.eventBus.publish({
          outcomeId: outcome.id,
          type: "outcome.updated",
          data: outcome
        });
      }

      const appendedMessage = await appendInboundMessage(
        options.repositories,
        message,
        outcome.id
      );

      if (
        !appendedMessage.appended &&
        existingBinding &&
        existingBinding.lastInboundMessageId !== message.externalMessageId
      ) {
        return {
          accepted: true,
          outcomeId: outcome.id,
          created: false,
          duplicate: true
        };
      }

      options.eventBus.publish({
        outcomeId: outcome.id,
        type: "message.created",
        data: appendedMessage.message
      });

      const binding = await options.repositories.messaging.bindConversation({
        id:
          existingBinding?.id ??
          deterministicId(
            "binding",
            inboundConversationKey({
              channel: message.channel,
              externalWorkspaceId: message.externalWorkspaceId,
              conversationId: message.conversationId,
              threadId: message.threadId
            })
          ),
        workspaceId: message.workspaceId,
        outcomeId: outcome.id,
        channel: message.channel,
        connectionId: message.connectionId,
        externalWorkspaceId: message.externalWorkspaceId,
        conversationId: message.conversationId,
        threadId: message.threadId,
        lastInboundMessageId: message.externalMessageId,
        lastOutboundDeliveryId: existingBinding?.lastOutboundDeliveryId ?? null,
        createdAt: existingBinding?.createdAt ?? message.receivedAt,
        updatedAt: message.receivedAt
      });

      await persistConnectionState(connection, {
        lastInboundAt: message.receivedAt,
        lastError: null,
        outcomeId: outcome.id
      });

      await recordDelivery(binding, connection, {
        outcomeId: outcome.id,
        kind: "status_update",
        body: created
          ? `Outcome ${outcome.id} created from ${message.channel} message.`
          : `Outcome ${outcome.id} updated from ${message.channel} message.`,
        runId: null
      });

      return {
        accepted: true,
        outcomeId: outcome.id,
        created,
        duplicate: false
      };
    },
    async deliverToOutcome(input) {
      const bindings = (
        await options.repositories.messaging.listBindingsByOutcome(input.outcomeId)
      )
        .map((binding) => binding)
        .sort(compareBindingsNewestFirst);

      if (bindings.length === 0) {
        throw new Error(`Outcome ${input.outcomeId} does not have a messaging binding.`);
      }

      const binding = bindings[0]!;
      const connection = await options.repositories.messaging.getConnectionById(
        binding.connectionId
      );

      if (!connection) {
        throw new Error(
          `Messaging connection ${binding.connectionId} does not exist for outcome ${input.outcomeId}.`
        );
      }

      if (!connection.enabled || connection.status === "disabled") {
        throw new Error(`Messaging connection ${binding.connectionId} is disabled.`);
      }

      return recordDelivery(binding, connection, input);
    },
    async getOutcomeHistory(outcomeId) {
      const bindings = (
        await options.repositories.messaging.listBindingsByOutcome(outcomeId)
      )
        .map((binding) => binding)
        .sort(compareBindingsNewestFirst);
      const connection = bindings[0]
        ? await options.repositories.messaging.getConnectionById(bindings[0].connectionId)
        : null;

      return {
        connection,
        bindings,
        deliveries: [...(deliveriesByOutcome.get(outcomeId) ?? [])]
      };
    },
    close() {
      deliveriesByOutcome.clear();
    }
  };
}
