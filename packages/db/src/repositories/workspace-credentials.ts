import { eq } from "drizzle-orm";
import type {
  WorkspaceCredentialMetadata,
  WorkspaceCredentialStatus
} from "@computer-oss/protocol";
import type { DatabaseClient } from "../client";
import { workspaceCredentials, workspaces } from "../schema";

type WorkspaceCredentialRow = typeof workspaceCredentials.$inferSelect;

export type StoredWorkspaceCredential = WorkspaceCredentialMetadata & {
  secretCiphertext: string;
  secretNonce: string;
  secretVersion: number;
};

export type CreateWorkspaceCredentialInput = StoredWorkspaceCredential;

export type UpdateWorkspaceCredentialInput = {
  id: string;
  label?: string;
  secretCiphertext?: string;
  secretNonce?: string;
  secretVersion?: number;
  status?: WorkspaceCredentialStatus;
  updatedAt: string;
  lastValidatedAt?: string | null;
};

function workspaceName(id: string) {
  return `Workspace ${id}`;
}

function mapMetadataRow(row: WorkspaceCredentialRow): WorkspaceCredentialMetadata {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    providerId: row.providerId,
    label: row.label,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null
  };
}

function compareCredentialRows(left: WorkspaceCredentialRow, right: WorkspaceCredentialRow) {
  const createdDelta = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
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

export class WorkspaceCredentialRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreateWorkspaceCredentialInput): Promise<WorkspaceCredentialMetadata> {
    await ensureWorkspace(this.db, input.workspaceId);

    const [created] = await this.db
      .insert(workspaceCredentials)
      .values({
        id: input.id,
        workspaceId: input.workspaceId,
        providerId: input.providerId,
        label: input.label,
        secretCiphertext: input.secretCiphertext,
        secretNonce: input.secretNonce,
        secretVersion: input.secretVersion,
        status: input.status,
        createdAt: new Date(input.createdAt),
        updatedAt: new Date(input.updatedAt),
        lastValidatedAt: input.lastValidatedAt
          ? new Date(input.lastValidatedAt)
          : null
      })
      .returning();

    return mapMetadataRow(created);
  }

  async getById(id: string): Promise<WorkspaceCredentialMetadata | null> {
    const rows = await this.db.select().from(workspaceCredentials);
    const found = rows.find((row) => row.id === id);

    return found ? mapMetadataRow(found) : null;
  }

  async listByWorkspace(workspaceId: string): Promise<WorkspaceCredentialMetadata[]> {
    const rows = await this.db.select().from(workspaceCredentials);

    return rows
      .filter((row) => row.workspaceId === workspaceId)
      .sort(compareCredentialRows)
      .map(mapMetadataRow);
  }

  async update(
    input: UpdateWorkspaceCredentialInput
  ): Promise<WorkspaceCredentialMetadata | null> {
    const [updated] = await this.db
      .update(workspaceCredentials)
      .set({
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.secretCiphertext !== undefined
          ? { secretCiphertext: input.secretCiphertext }
          : {}),
        ...(input.secretNonce !== undefined ? { secretNonce: input.secretNonce } : {}),
        ...(input.secretVersion !== undefined
          ? { secretVersion: input.secretVersion }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.lastValidatedAt !== undefined
          ? {
              lastValidatedAt: input.lastValidatedAt
                ? new Date(input.lastValidatedAt)
                : null
            }
          : {}),
        updatedAt: new Date(input.updatedAt)
      })
      .where(eq(workspaceCredentials.id, input.id))
      .returning();

    return updated ? mapMetadataRow(updated) : null;
  }

  async delete(id: string): Promise<boolean> {
    const removed = await this.db
      .delete(workspaceCredentials)
      .where(eq(workspaceCredentials.id, id))
      .returning();

    return removed.length > 0;
  }
}
