import { and, asc, eq } from "drizzle-orm";
import type { DatabaseClient } from "../client";
import {
  artifactLineageEdges,
  approvals,
  artifacts,
  messagingConversationBindings,
  outcomeMessages,
  outcomePlans,
  outcomeRuns,
  outcomes,
  planEdges,
  planNodes,
  runAuditEvents,
  runCheckpoints,
  runEvents,
  runSteps,
  scheduleFires,
  workspaceLeases,
  users,
  workspaces
} from "../schema";

type OutcomeRow = typeof outcomes.$inferSelect;
type OutcomeMessageRow = typeof outcomeMessages.$inferSelect;
type OutcomeSource = "web" | "schedule" | "slack" | "telegram";
type OutcomeStatus = OutcomeRow["status"];

export type StoredOutcome = {
  id: string;
  workspaceId: string;
  userId: string;
  prompt: string;
  source: OutcomeSource;
  status: OutcomeStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateOutcomeInput = {
  id: string;
  workspaceId: string;
  userId: string;
  prompt: string;
  source: OutcomeSource;
};

export type UpdateOutcomeStatusInput = {
  id: string;
  status: OutcomeStatus;
  updatedAt: string;
};

export type AppendOutcomeMessageInput = {
  id: string;
  outcomeId: string;
  role: "user" | "assistant" | "system";
  content: string;
  submissionId: string | null;
  createdAt: string;
};

export type StoredOutcomeMessage = AppendOutcomeMessageInput;

function mapOutcomeRow(row: OutcomeRow): StoredOutcome {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    prompt: row.prompt,
    source: row.source as OutcomeSource,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapOutcomeMessageRow(row: OutcomeMessageRow): StoredOutcomeMessage {
  return {
    id: row.id,
    outcomeId: row.outcomeId,
    role: row.role as StoredOutcomeMessage["role"],
    content: row.content,
    submissionId: row.submissionId,
    createdAt: row.createdAt.toISOString()
  };
}

function workspaceName(id: string) {
  return `Workspace ${id}`;
}

function userEmail(id: string) {
  return `${id}@local.mycelium`;
}

export class OutcomeRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreateOutcomeInput): Promise<StoredOutcome> {
    await this.db
      .insert(workspaces)
      .values({
        id: input.workspaceId,
        name: workspaceName(input.workspaceId)
      })
      .onConflictDoNothing();

    await this.db
      .insert(users)
      .values({
        id: input.userId,
        email: userEmail(input.userId)
      })
      .onConflictDoNothing();

    const [created] = await this.db
      .insert(outcomes)
      .values({
        id: input.id,
        workspaceId: input.workspaceId,
        userId: input.userId,
        prompt: input.prompt,
        source: input.source,
        status: "draft"
      })
      .returning();

    return mapOutcomeRow(created);
  }

  async getById(id: string): Promise<StoredOutcome | null> {
    const [found] = await this.db.select().from(outcomes).where(eq(outcomes.id, id));
    return found ? mapOutcomeRow(found) : null;
  }

  async getMessageById(id: string): Promise<StoredOutcomeMessage | null> {
    const [found] = await this.db
      .select()
      .from(outcomeMessages)
      .where(eq(outcomeMessages.id, id));

    if (!found) {
      return null;
    }

    return mapOutcomeMessageRow(found);
  }

  async getMessageBySubmissionId(
    outcomeId: string,
    submissionId: string
  ): Promise<StoredOutcomeMessage | null> {
    const [found] = await this.db
      .select()
      .from(outcomeMessages)
      .where(
        and(
          eq(outcomeMessages.outcomeId, outcomeId),
          eq(outcomeMessages.submissionId, submissionId)
        )
      );

    if (!found) {
      return null;
    }

    return mapOutcomeMessageRow(found);
  }

  async listMessages(outcomeId: string): Promise<StoredOutcomeMessage[]> {
    const rows = await this.db
      .select()
      .from(outcomeMessages)
      .where(eq(outcomeMessages.outcomeId, outcomeId))
      .orderBy(asc(outcomeMessages.createdAt), asc(outcomeMessages.id));

    return rows.map(mapOutcomeMessageRow);
  }

  async listByWorkspace(workspaceId: string): Promise<StoredOutcome[]> {
    const rows = await this.db
      .select()
      .from(outcomes)
      .where(eq(outcomes.workspaceId, workspaceId));

    return rows.map(mapOutcomeRow);
  }

  async updateStatus(
    input: UpdateOutcomeStatusInput
  ): Promise<StoredOutcome | null> {
    const [updated] = await this.db
      .update(outcomes)
      .set({
        status: input.status,
        updatedAt: new Date(input.updatedAt)
      })
      .where(eq(outcomes.id, input.id))
      .returning();

    return updated ? mapOutcomeRow(updated) : null;
  }

  async appendMessage(input: AppendOutcomeMessageInput): Promise<void> {
    await this.db.insert(outcomeMessages).values({
      id: input.id,
      outcomeId: input.outcomeId,
      role: input.role,
      content: input.content,
      submissionId: input.submissionId,
      createdAt: new Date(input.createdAt)
    });
  }

  async deleteMessage(id: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(outcomeMessages)
      .where(eq(outcomeMessages.id, id))
      .returning();

    return Boolean(deleted);
  }

  async delete(id: string): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(outcomes)
        .where(eq(outcomes.id, id));

      if (!existing) {
        return false;
      }

      const runRows = await transaction
        .select()
        .from(outcomeRuns)
        .where(eq(outcomeRuns.outcomeId, id));

      for (const run of runRows) {
        const runStepRows = await transaction
          .select()
          .from(runSteps)
          .where(eq(runSteps.runId, run.id));
        const stepIds = runStepRows.map((step) => step.id);

        const approvalRows = await transaction.select().from(approvals);
        for (const approval of approvalRows.filter((row) => row.runId === run.id)) {
          await transaction.delete(approvals).where(eq(approvals.id, approval.id));
        }

        const artifactRows = await transaction.select().from(artifacts);
        for (const artifact of artifactRows.filter((row) => row.runId === run.id)) {
          await transaction.delete(artifacts).where(eq(artifacts.id, artifact.id));
        }

        const lineageRows = await transaction.select().from(artifactLineageEdges);
        for (const edge of lineageRows.filter((row) => row.runId === run.id)) {
          await transaction
            .delete(artifactLineageEdges)
            .where(eq(artifactLineageEdges.id, edge.id));
        }

        const auditRows = await transaction.select().from(runAuditEvents);
        for (const event of auditRows.filter((row) => row.runId === run.id)) {
          await transaction.delete(runAuditEvents).where(eq(runAuditEvents.id, event.id));
        }

        const checkpointRows = await transaction.select().from(runCheckpoints);
        for (const checkpoint of checkpointRows.filter((row) => row.runId === run.id)) {
          await transaction
            .delete(runCheckpoints)
            .where(eq(runCheckpoints.id, checkpoint.id));
        }

        const leaseRows = await transaction.select().from(workspaceLeases);
        for (const lease of leaseRows.filter((row) => row.runId === run.id)) {
          await transaction.delete(workspaceLeases).where(eq(workspaceLeases.runId, lease.runId));
        }

        const fireRows = await transaction.select().from(scheduleFires);
        for (const fire of fireRows.filter((row) => row.runId === run.id)) {
          await transaction.delete(scheduleFires).where(eq(scheduleFires.id, fire.id));
        }

        const eventRows = await transaction.select().from(runEvents);
        for (const event of eventRows.filter((row) => row.runId === run.id)) {
          await transaction.delete(runEvents).where(eq(runEvents.id, event.id));
        }

        for (const stepId of stepIds) {
          await transaction.delete(runSteps).where(eq(runSteps.id, stepId));
        }

        await transaction.delete(outcomeRuns).where(eq(outcomeRuns.id, run.id));
      }

      const planRows = await transaction
        .select()
        .from(outcomePlans)
        .where(eq(outcomePlans.outcomeId, id));

      for (const plan of planRows) {
        const edgeRows = await transaction.select().from(planEdges);
        for (const edge of edgeRows.filter((row) => row.planId === plan.id)) {
          await transaction.delete(planEdges).where(eq(planEdges.id, edge.id));
        }

        const nodeRows = await transaction.select().from(planNodes);
        for (const node of nodeRows.filter((row) => row.planId === plan.id)) {
          await transaction.delete(planNodes).where(eq(planNodes.id, node.id));
        }

        await transaction.delete(outcomePlans).where(eq(outcomePlans.id, plan.id));
      }

      const messageRows = await transaction
        .select()
        .from(outcomeMessages)
        .where(eq(outcomeMessages.outcomeId, id));

      for (const message of messageRows) {
        await transaction.delete(outcomeMessages).where(eq(outcomeMessages.id, message.id));
      }

      const bindingRows = await transaction
        .select()
        .from(messagingConversationBindings)
        .where(eq(messagingConversationBindings.outcomeId, id));

      for (const binding of bindingRows) {
        await transaction
          .delete(messagingConversationBindings)
          .where(eq(messagingConversationBindings.id, binding.id));
      }

      const fireRows = await transaction.select().from(scheduleFires);
      for (const fire of fireRows.filter((row) => row.outcomeId === id)) {
        await transaction.delete(scheduleFires).where(eq(scheduleFires.id, fire.id));
      }

      await transaction.delete(outcomes).where(eq(outcomes.id, id));

      return true;
    });
  }
}
