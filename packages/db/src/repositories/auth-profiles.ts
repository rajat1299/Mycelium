import { eq } from "drizzle-orm";
import { AuthProfileSchema, type AuthProfile } from "@computer-oss/protocol";
import type { DatabaseClient } from "../client";
import { authProfiles, workspaceCredentials } from "../schema";

type AuthProfileRow = typeof authProfiles.$inferSelect;
type WorkspaceCredentialRow = typeof workspaceCredentials.$inferSelect;

export type CreateAuthProfileInput = AuthProfile;

export type UpdateAuthProfileInput = {
  id: string;
  label?: string;
  credentialId?: string;
  status?: AuthProfile["status"];
  priority?: number;
  cooldownUntil?: string | null;
  lastValidatedAt?: string | null;
  updatedAt: string;
};

function mapAuthProfileRow(row: AuthProfileRow): AuthProfile {
  return AuthProfileSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    providerId: row.providerId,
    label: row.label,
    credentialId: row.credentialId,
    status: row.status,
    priority: row.priority,
    cooldownUntil: row.cooldownUntil?.toISOString() ?? null,
    lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  });
}

function compareAuthProfileRows(left: AuthProfileRow, right: AuthProfileRow) {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  const createdDelta = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

function validateCredentialOwnership(
  credential: WorkspaceCredentialRow | undefined,
  workspaceId: string,
  providerId: string,
  credentialId: string
) {
  if (!credential) {
    throw new Error(`Credential ${credentialId} does not exist.`);
  }

  if (credential.workspaceId !== workspaceId) {
    throw new Error(
      `Credential ${credentialId} belongs to workspace ${credential.workspaceId}, not ${workspaceId}.`
    );
  }

  if (credential.providerId !== providerId) {
    throw new Error(
      `Credential ${credentialId} belongs to provider ${credential.providerId}, not ${providerId}.`
    );
  }
}

export class AuthProfileRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreateAuthProfileInput): Promise<AuthProfile> {
    const parsed = AuthProfileSchema.parse(input);
    const credentials = await this.db.select().from(workspaceCredentials);
    const credential = credentials.find(
      (candidate) => candidate.id === parsed.credentialId
    );

    validateCredentialOwnership(
      credential,
      parsed.workspaceId,
      parsed.providerId,
      parsed.credentialId
    );

    const [created] = await this.db
      .insert(authProfiles)
      .values({
        id: parsed.id,
        workspaceId: parsed.workspaceId,
        providerId: parsed.providerId,
        label: parsed.label,
        credentialId: parsed.credentialId,
        status: parsed.status,
        priority: parsed.priority,
        cooldownUntil: parsed.cooldownUntil ? new Date(parsed.cooldownUntil) : null,
        lastValidatedAt: parsed.lastValidatedAt
          ? new Date(parsed.lastValidatedAt)
          : null,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt)
      })
      .returning();

    return mapAuthProfileRow(created);
  }

  async getById(id: string): Promise<AuthProfile | null> {
    const rows = await this.db.select().from(authProfiles);
    const found = rows.find((row) => row.id === id);

    return found ? mapAuthProfileRow(found) : null;
  }

  async listByWorkspace(workspaceId: string): Promise<AuthProfile[]> {
    const rows = await this.db.select().from(authProfiles);

    return rows
      .filter((row) => row.workspaceId === workspaceId)
      .sort(compareAuthProfileRows)
      .map(mapAuthProfileRow);
  }

  async update(input: UpdateAuthProfileInput): Promise<AuthProfile | null> {
    const current = await this.getById(input.id);

    if (!current) {
      return null;
    }

    const nextCredentialId = input.credentialId ?? current.credentialId;

    if (nextCredentialId !== current.credentialId) {
      const credentials = await this.db.select().from(workspaceCredentials);
      const credential = credentials.find(
        (candidate) => candidate.id === nextCredentialId
      );

      validateCredentialOwnership(
        credential,
        current.workspaceId,
        current.providerId,
        nextCredentialId
      );
    }

    const [updated] = await this.db
      .update(authProfiles)
      .set({
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.credentialId !== undefined
          ? { credentialId: input.credentialId }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.cooldownUntil !== undefined
          ? {
              cooldownUntil: input.cooldownUntil
                ? new Date(input.cooldownUntil)
                : null
            }
          : {}),
        ...(input.lastValidatedAt !== undefined
          ? {
              lastValidatedAt: input.lastValidatedAt
                ? new Date(input.lastValidatedAt)
                : null
            }
          : {}),
        updatedAt: new Date(input.updatedAt)
      })
      .where(eq(authProfiles.id, input.id))
      .returning();

    return updated ? mapAuthProfileRow(updated) : null;
  }

  async delete(id: string): Promise<boolean> {
    const removed = await this.db
      .delete(authProfiles)
      .where(eq(authProfiles.id, id))
      .returning();

    return removed.length > 0;
  }
}
