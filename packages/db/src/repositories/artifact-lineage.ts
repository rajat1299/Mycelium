import type { DatabaseClient } from "../client";
import { artifactLineageEdges, artifacts, outcomeRuns, runSteps } from "../schema";

type ArtifactLineageRow = typeof artifactLineageEdges.$inferSelect;

export type StoredArtifactLineageEdge = {
  id: string;
  runId: string;
  parentArtifactId: string;
  childArtifactId: string;
  parentStepId: string;
  childStepId: string;
  relation: ArtifactLineageRow["relation"];
  createdAt: string;
};

export type CreateArtifactLineageEdgeInput = {
  id: string;
  runId: string;
  parentArtifactId: string;
  childArtifactId: string;
  parentStepId: string;
  childStepId: string;
  relation: ArtifactLineageRow["relation"];
  createdAt: string;
};

function mapLineageRow(row: ArtifactLineageRow): StoredArtifactLineageEdge {
  return {
    id: row.id,
    runId: row.runId,
    parentArtifactId: row.parentArtifactId,
    childArtifactId: row.childArtifactId,
    parentStepId: row.parentStepId,
    childStepId: row.childStepId,
    relation: row.relation,
    createdAt: row.createdAt.toISOString()
  };
}

function compareLineageRows(left: ArtifactLineageRow, right: ArtifactLineageRow) {
  const createdDelta = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

export class ArtifactLineageRepository {
  constructor(private readonly db: DatabaseClient) {}

  async createMany(
    inputs: CreateArtifactLineageEdgeInput[]
  ): Promise<StoredArtifactLineageEdge[]> {
    if (inputs.length === 0) {
      return [];
    }

    return this.db.transaction(async (transaction) => {
      const [runRows, stepRows, artifactRows] = await Promise.all([
        transaction.select().from(outcomeRuns),
        transaction.select().from(runSteps),
        transaction.select().from(artifacts)
      ]);

      for (const input of inputs) {
        const run = runRows.find((row) => row.id === input.runId);

        if (!run) {
          throw new Error(`Run ${input.runId} does not exist.`);
        }

        const parentArtifact = artifactRows.find(
          (row) => row.id === input.parentArtifactId
        );
        const childArtifact = artifactRows.find(
          (row) => row.id === input.childArtifactId
        );

        if (!parentArtifact) {
          throw new Error(`Artifact ${input.parentArtifactId} does not exist.`);
        }

        if (!childArtifact) {
          throw new Error(`Artifact ${input.childArtifactId} does not exist.`);
        }

        const parentStep = stepRows.find((row) => row.id === input.parentStepId);
        const childStep = stepRows.find((row) => row.id === input.childStepId);

        if (!parentStep) {
          throw new Error(`Step ${input.parentStepId} does not exist.`);
        }

        if (!childStep) {
          throw new Error(`Step ${input.childStepId} does not exist.`);
        }

        if (
          parentArtifact.runId !== input.runId ||
          childArtifact.runId !== input.runId ||
          parentStep.runId !== input.runId ||
          childStep.runId !== input.runId
        ) {
          throw new Error(
            `Artifact-lineage edges must stay within run ${input.runId}.`
          );
        }

        if (
          parentArtifact.stepId !== input.parentStepId ||
          childArtifact.stepId !== input.childStepId
        ) {
          throw new Error(
            `Artifact-lineage edges must match their parent and child step context.`
          );
        }
      }

      const created = await transaction
        .insert(artifactLineageEdges)
        .values(
          inputs.map((input) => ({
            id: input.id,
            runId: input.runId,
            parentArtifactId: input.parentArtifactId,
            childArtifactId: input.childArtifactId,
            parentStepId: input.parentStepId,
            childStepId: input.childStepId,
            relation: input.relation,
            createdAt: new Date(input.createdAt)
          }))
        )
        .returning();

      return created.sort(compareLineageRows).map(mapLineageRow);
    });
  }

  async listByRun(runId: string): Promise<StoredArtifactLineageEdge[]> {
    const rows = await this.db.select().from(artifactLineageEdges);

    return rows
      .filter((row) => row.runId === runId)
      .sort(compareLineageRows)
      .map(mapLineageRow);
  }

  async listByArtifact(artifactId: string): Promise<StoredArtifactLineageEdge[]> {
    const rows = await this.db.select().from(artifactLineageEdges);

    return rows
      .filter(
        (row) =>
          row.parentArtifactId === artifactId || row.childArtifactId === artifactId
      )
      .sort(compareLineageRows)
      .map(mapLineageRow);
  }
}
