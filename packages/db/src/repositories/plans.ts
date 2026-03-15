import type { ApprovalRequirement } from "@computer-oss/protocol";
import type { DatabaseClient } from "../client";
import { outcomePlans, planEdges, planNodes } from "../schema";

type PlanRow = typeof outcomePlans.$inferSelect;
type PlanNodeRow = typeof planNodes.$inferSelect;
type PlanEdgeRow = typeof planEdges.$inferSelect;

function mapApprovalRequirement(
  row: Pick<
    PlanNodeRow,
    "approvalKind" | "approvalTitle" | "approvalSummary" | "approvalInstruction"
  >
): ApprovalRequirement | undefined {
  if (!row.approvalKind || !row.approvalTitle) {
    return undefined;
  }

  return {
    kind: row.approvalKind as ApprovalRequirement["kind"],
    title: row.approvalTitle,
    summary: row.approvalSummary ?? null,
    instruction: row.approvalInstruction ?? null
  };
}

export type StoredPlan = {
  id: string;
  outcomeId: string;
  status: PlanRow["status"];
  createdAt: string;
  updatedAt: string;
};

export type StoredPlanNode = {
  id: string;
  planId: string;
  kind: string;
  title: string;
  capability: string;
  instruction?: string;
  template?: string;
  approvalRequirement?: ApprovalRequirement;
  expectedArtifactPath?: string;
  expectedArtifactKind?: string;
  position: number;
};

export type StoredPlanEdge = {
  id: string;
  planId: string;
  from: string;
  to: string;
};

export type CreatePlanInput = {
  id: string;
  outcomeId: string;
  status: PlanRow["status"];
  createdAt: string;
  updatedAt: string;
  nodes: Array<
    Pick<
      StoredPlanNode,
      | "id"
      | "kind"
      | "title"
      | "capability"
      | "instruction"
      | "template"
      | "approvalRequirement"
      | "expectedArtifactPath"
      | "expectedArtifactKind"
    >
  >;
  edges: Array<Pick<StoredPlanEdge, "id" | "from" | "to">>;
};

function mapPlanRow(row: PlanRow): StoredPlan {
  return {
    id: row.id,
    outcomeId: row.outcomeId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapPlanNodeRow(row: PlanNodeRow): StoredPlanNode {
  const approvalRequirement = mapApprovalRequirement(row);

  return {
    id: row.id,
    planId: row.planId,
    kind: row.kind,
    title: row.title,
    capability: row.capability,
    ...(row.instruction ? { instruction: row.instruction } : {}),
    ...(row.template ? { template: row.template } : {}),
    ...(approvalRequirement ? { approvalRequirement } : {}),
    ...(row.expectedArtifactPath
      ? { expectedArtifactPath: row.expectedArtifactPath }
      : {}),
    ...(row.expectedArtifactKind
      ? { expectedArtifactKind: row.expectedArtifactKind }
      : {}),
    position: row.position
  };
}

function mapPlanEdgeRow(row: PlanEdgeRow): StoredPlanEdge {
  return {
    id: row.id,
    planId: row.planId,
    from: row.from,
    to: row.to
  };
}

export class PlanRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreatePlanInput): Promise<StoredPlan> {
    return this.db.transaction(async (transaction) => {
      const existingPlans = await transaction.select().from(outcomePlans);

      if (existingPlans.some((plan) => plan.outcomeId === input.outcomeId)) {
        throw new Error(`Plan already exists for outcome ${input.outcomeId}.`);
      }

      const inputNodeIds = new Set(input.nodes.map((node) => node.id));

      if (
        input.edges.some(
          (edge) => !inputNodeIds.has(edge.from) || !inputNodeIds.has(edge.to)
        )
      ) {
        throw new Error("Plan edges must reference nodes from the same plan input.");
      }

      const [created] = await transaction
        .insert(outcomePlans)
        .values({
          id: input.id,
          outcomeId: input.outcomeId,
          status: input.status,
          createdAt: new Date(input.createdAt),
          updatedAt: new Date(input.updatedAt)
        })
        .returning();

      if (input.nodes.length > 0) {
        await transaction.insert(planNodes).values(
          input.nodes.map((node, index) => ({
            id: node.id,
            planId: input.id,
            kind: node.kind,
            title: node.title,
            capability: node.capability,
            ...(node.instruction ? { instruction: node.instruction } : {}),
            ...(node.template ? { template: node.template } : {}),
            ...(node.approvalRequirement
              ? {
                  approvalKind: node.approvalRequirement.kind,
                  approvalTitle: node.approvalRequirement.title,
                  approvalSummary: node.approvalRequirement.summary,
                  approvalInstruction: node.approvalRequirement.instruction
                }
              : {}),
            ...(node.expectedArtifactPath
              ? { expectedArtifactPath: node.expectedArtifactPath }
              : {}),
            ...(node.expectedArtifactKind
              ? { expectedArtifactKind: node.expectedArtifactKind }
              : {}),
            position: index
          }))
        );
      }

      if (input.edges.length > 0) {
        await transaction.insert(planEdges).values(
          input.edges.map((edge) => ({
            id: edge.id,
            planId: input.id,
            from: edge.from,
            to: edge.to
          }))
        );
      }

      return mapPlanRow(created);
    });
  }

  async getByOutcome(outcomeId: string): Promise<StoredPlan | null> {
    const rows = await this.db.select().from(outcomePlans);
    const found = rows.find((row) => row.outcomeId === outcomeId);
    return found ? mapPlanRow(found) : null;
  }

  async listNodes(planId: string): Promise<StoredPlanNode[]> {
    const rows = await this.db.select().from(planNodes);
    return rows
      .filter((row) => row.planId === planId)
      .sort((left, right) => left.position - right.position)
      .map(mapPlanNodeRow);
  }

  async listEdges(planId: string): Promise<StoredPlanEdge[]> {
    const rows = await this.db.select().from(planEdges);
    return rows.filter((row) => row.planId === planId).map(mapPlanEdgeRow);
  }
}
