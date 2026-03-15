import type { DatabaseClient } from "../client";
import { artifacts, outcomeRuns, runSteps } from "../schema";

type ArtifactRow = typeof artifacts.$inferSelect;

export type StoredArtifact = {
  id: string;
  outcomeId: string;
  runId: string | null;
  stepId: string | null;
  kind: string;
  relativePath: string;
  size: number;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CreateArtifactInput = {
  id: string;
  outcomeId: string;
  runId?: string;
  stepId?: string;
  kind: string;
  relativePath: string;
  size: number;
  metadata: Record<string, unknown>;
  createdAt: string;
};

function mapArtifactRow(row: ArtifactRow): StoredArtifact {
  return {
    id: row.id,
    outcomeId: row.outcomeId,
    runId: row.runId ?? null,
    stepId: row.stepId ?? null,
    kind: row.kind,
    relativePath: row.relativePath,
    size: row.size,
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.createdAt.toISOString()
  };
}

function compareArtifactRows(left: ArtifactRow, right: ArtifactRow) {
  const createdDelta = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

export class ArtifactRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreateArtifactInput): Promise<StoredArtifact> {
    return this.db.transaction(async (transaction) => {
      const [runRows, stepRows] = await Promise.all([
        transaction.select().from(outcomeRuns),
        transaction.select().from(runSteps)
      ]);

      if (input.runId) {
        const run = runRows.find((row) => row.id === input.runId);

        if (!run) {
          throw new Error(`Run ${input.runId} does not exist.`);
        }

        if (run.outcomeId !== input.outcomeId) {
          throw new Error(
            `Run ${input.runId} belongs to ${run.outcomeId}, not ${input.outcomeId}.`
          );
        }
      }

      if (input.stepId) {
        if (!input.runId) {
          throw new Error("Artifact step scope requires a runId.");
        }

        const step = stepRows.find((row) => row.id === input.stepId);

        if (!step) {
          throw new Error(`Step ${input.stepId} does not exist.`);
        }

        if (step.runId !== input.runId) {
          throw new Error(
            `Step ${input.stepId} belongs to ${step.runId}, not ${input.runId}.`
          );
        }
      }

      const [created] = await transaction
        .insert(artifacts)
        .values({
          id: input.id,
          outcomeId: input.outcomeId,
          ...(input.runId ? { runId: input.runId } : {}),
          ...(input.stepId ? { stepId: input.stepId } : {}),
          kind: input.kind,
          relativePath: input.relativePath,
          size: input.size,
          metadata: input.metadata,
          createdAt: new Date(input.createdAt)
        })
        .returning();

      return mapArtifactRow(created);
    });
  }

  async listByRun(runId: string): Promise<StoredArtifact[]> {
    const rows = await this.db.select().from(artifacts);

    return rows
      .filter((row) => row.runId === runId)
      .sort(compareArtifactRows)
      .map(mapArtifactRow);
  }

  async listByStep(stepId: string): Promise<StoredArtifact[]> {
    const rows = await this.db.select().from(artifacts);

    return rows
      .filter((row) => row.stepId === stepId)
      .sort(compareArtifactRows)
      .map(mapArtifactRow);
  }

  async listByOutcome(outcomeId: string): Promise<StoredArtifact[]> {
    const rows = await this.db.select().from(artifacts);

    return rows
      .filter((row) => row.outcomeId === outcomeId)
      .sort(compareArtifactRows)
      .map(mapArtifactRow);
  }

  async getById(id: string): Promise<StoredArtifact | null> {
    const rows = await this.db.select().from(artifacts);
    const found = rows.find((row) => row.id === id);

    return found ? mapArtifactRow(found) : null;
  }

  async listByIds(ids: string[]): Promise<StoredArtifact[]> {
    if (ids.length === 0) {
      return [];
    }

    const idSet = new Set(ids);
    const rows = await this.db.select().from(artifacts);

    return rows
      .filter((row) => idSet.has(row.id))
      .sort(compareArtifactRows)
      .map(mapArtifactRow);
  }
}
