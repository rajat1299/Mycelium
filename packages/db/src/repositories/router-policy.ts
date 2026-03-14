import { eq } from "drizzle-orm";
import {
  RouterPolicySchema,
  type AuthProfile,
  type RouterPolicy,
  type RouterPolicyCandidate
} from "@computer-oss/protocol";
import type { DatabaseClient } from "../client";
import {
  authProfiles,
  routerPolicies,
  routerPolicyCandidates,
  workspaces
} from "../schema";

type RouterPolicyRow = typeof routerPolicies.$inferSelect;
type RouterPolicyCandidateRow = typeof routerPolicyCandidates.$inferSelect;
type AuthProfileRow = typeof authProfiles.$inferSelect;

function workspaceName(id: string) {
  return `Workspace ${id}`;
}

function compareCandidates(
  left: RouterPolicyCandidate,
  right: RouterPolicyCandidate
) {
  if (left.capability !== right.capability) {
    return left.capability.localeCompare(right.capability);
  }

  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  return `${left.providerId}:${left.modelId}:${left.authProfileId ?? ""}`.localeCompare(
    `${right.providerId}:${right.modelId}:${right.authProfileId ?? ""}`
  );
}

function mapCandidateRow(row: RouterPolicyCandidateRow): RouterPolicyCandidate {
  return {
    capability: row.capability as RouterPolicyCandidate["capability"],
    priority: row.priority,
    providerId: row.providerId,
    modelId: row.modelId,
    authProfileId: row.authProfileId,
    enabled: row.enabled
  };
}

function mapPolicy(
  row: RouterPolicyRow,
  candidateRows: RouterPolicyCandidateRow[]
): RouterPolicy {
  return RouterPolicySchema.parse({
    workspaceId: row.workspaceId,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    candidates: candidateRows.map(mapCandidateRow).sort(compareCandidates)
  });
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

function validateCandidateProfile(
  profile: AuthProfileRow | undefined,
  workspaceId: string,
  candidate: RouterPolicyCandidate
) {
  if (!candidate.authProfileId) {
    return;
  }

  if (!profile) {
    throw new Error(`Auth profile ${candidate.authProfileId} does not exist.`);
  }

  if (profile.workspaceId !== workspaceId) {
    throw new Error(
      `Auth profile ${candidate.authProfileId} belongs to workspace ${profile.workspaceId}, not ${workspaceId}.`
    );
  }

  if (profile.providerId !== candidate.providerId) {
    throw new Error(
      `Auth profile ${candidate.authProfileId} belongs to provider ${profile.providerId}, not ${candidate.providerId}.`
    );
  }
}

export class RouterPolicyRepository {
  constructor(private readonly db: DatabaseClient) {}

  async getByWorkspace(workspaceId: string): Promise<RouterPolicy | null> {
    const [policyRows, candidateRows] = await Promise.all([
      this.db.select().from(routerPolicies),
      this.db.select().from(routerPolicyCandidates)
    ]);
    const policy = policyRows.find((row) => row.workspaceId === workspaceId);

    if (!policy) {
      return null;
    }

    return mapPolicy(
      policy,
      candidateRows.filter((row) => row.workspaceId === workspaceId)
    );
  }

  async upsert(input: RouterPolicy): Promise<RouterPolicy> {
    const policy = RouterPolicySchema.parse(input);
    const profileRows = await this.db.select().from(authProfiles);

    for (const candidate of policy.candidates) {
      if (!candidate.authProfileId) {
        continue;
      }

      const profile = profileRows.find(
        (row) => row.id === candidate.authProfileId
      );

      validateCandidateProfile(profile, policy.workspaceId, candidate);
    }

    await ensureWorkspace(this.db, policy.workspaceId);

    return this.db.transaction(async (transaction) => {
      const existingPolicies = await transaction.select().from(routerPolicies);
      const existing = existingPolicies.find(
        (row) => row.workspaceId === policy.workspaceId
      );

      if (existing) {
        await transaction
          .update(routerPolicies)
          .set({
            version: policy.version,
            updatedAt: new Date(policy.updatedAt)
          })
          .where(eq(routerPolicies.workspaceId, policy.workspaceId))
          .returning();
      } else {
        await transaction
          .insert(routerPolicies)
          .values({
            workspaceId: policy.workspaceId,
            version: policy.version,
            updatedAt: new Date(policy.updatedAt)
          })
          .returning();
      }

      await transaction
        .delete(routerPolicyCandidates)
        .where(eq(routerPolicyCandidates.workspaceId, policy.workspaceId))
        .returning();

      if (policy.candidates.length > 0) {
        await transaction.insert(routerPolicyCandidates).values(
          policy.candidates.map((candidate, index) => ({
            id: `${policy.workspaceId}:${index}`,
            workspaceId: policy.workspaceId,
            capability: candidate.capability,
            priority: candidate.priority,
            providerId: candidate.providerId,
            modelId: candidate.modelId,
            authProfileId: candidate.authProfileId,
            enabled: candidate.enabled
          }))
        );
      }

      const [storedPolicyRows, storedCandidateRows] = await Promise.all([
        transaction.select().from(routerPolicies),
        transaction.select().from(routerPolicyCandidates)
      ]);
      const storedPolicy = storedPolicyRows.find(
        (row) => row.workspaceId === policy.workspaceId
      );

      if (!storedPolicy) {
        throw new Error(
          `Router policy for workspace ${policy.workspaceId} disappeared during write.`
        );
      }

      return mapPolicy(
        storedPolicy,
        storedCandidateRows.filter(
          (row) => row.workspaceId === policy.workspaceId
        )
      );
    });
  }
}
