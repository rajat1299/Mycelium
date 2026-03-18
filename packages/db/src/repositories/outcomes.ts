import { eq } from "drizzle-orm";
import type { DatabaseClient } from "../client";
import { outcomeMessages, outcomes, users, workspaces } from "../schema";

type OutcomeRow = typeof outcomes.$inferSelect;
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
  createdAt: string;
};

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
      createdAt: new Date(input.createdAt)
    });
  }
}
