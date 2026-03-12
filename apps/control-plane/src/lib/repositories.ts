import type {
  AppendRunEventInput,
  CreatePlanInput,
  CreateRunFromPlanInput,
  StoredPlan,
  StoredPlanEdge,
  StoredPlanNode,
  StoredRun,
  StoredRunStep,
  UpdateStepStatusInput
} from "@computer-oss/db";
import type {
  CreateOutcomeMessageRequest,
  CreateOutcomeRequest,
  Outcome
} from "@computer-oss/protocol";

export type CreateStoredOutcomeInput = CreateOutcomeRequest & { id: string };

export type AppendOutcomeMessageInput = CreateOutcomeMessageRequest & {
  id: string;
  outcomeId: string;
  createdAt: string;
};

export type OutcomeStore = {
  create(input: CreateStoredOutcomeInput): Promise<Outcome>;
  getById(id: string): Promise<Outcome | null>;
  listByWorkspace(workspaceId: string): Promise<Outcome[]>;
  appendMessage(input: AppendOutcomeMessageInput): Promise<void>;
};

export type PlanStore = {
  create(input: CreatePlanInput): Promise<StoredPlan>;
  getByOutcome(outcomeId: string): Promise<StoredPlan | null>;
  listNodes(planId: string): Promise<StoredPlanNode[]>;
  listEdges(planId: string): Promise<StoredPlanEdge[]>;
};

export type RunStore = {
  createFromPlan(input: CreateRunFromPlanInput): Promise<StoredRun>;
  getById(id: string): Promise<StoredRun | null>;
  listSteps(runId: string): Promise<StoredRunStep[]>;
  appendEvent(input: AppendRunEventInput): Promise<void>;
  updateStepStatus(input: UpdateStepStatusInput): Promise<StoredRunStep | null>;
};

export type Repositories = {
  outcomes: OutcomeStore;
  plans: PlanStore;
  runs: RunStore;
};

function createInMemoryRepositoriesState() {
  const outcomes = new Map<string, Outcome>();
  const plansByOutcomeId = new Map<string, StoredPlan>();
  const planNodesByPlanId = new Map<string, StoredPlanNode[]>();
  const planEdgesByPlanId = new Map<string, StoredPlanEdge[]>();
  const runsById = new Map<string, StoredRun>();
  const runStepsByRunId = new Map<string, StoredRunStep[]>();
  const runEvents: AppendRunEventInput[] = [];

  const outcomesStore: OutcomeStore = {
    async create(input) {
      const now = new Date().toISOString();
      const outcome: Outcome = {
        ...input,
        status: "draft",
        createdAt: now,
        updatedAt: now
      };

      outcomes.set(outcome.id, outcome);
      return outcome;
    },
    async getById(id) {
      return outcomes.get(id) ?? null;
    },
    async listByWorkspace(workspaceId) {
      return Array.from(outcomes.values()).filter(
        (outcome) => outcome.workspaceId === workspaceId
      );
    },
    async appendMessage(_input) {
      return;
    }
  };

  const plansStore: PlanStore = {
    async create(input) {
      if (plansByOutcomeId.has(input.outcomeId)) {
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

      const plan: StoredPlan = {
        id: input.id,
        outcomeId: input.outcomeId,
        status: input.status,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt
      };

      const nodes = input.nodes.map((node, index) => ({
        id: node.id,
        planId: input.id,
        kind: node.kind,
        title: node.title,
        capability: node.capability,
        position: index
      }));
      const edges = input.edges.map((edge) => ({
        id: edge.id,
        planId: input.id,
        from: edge.from,
        to: edge.to
      }));

      plansByOutcomeId.set(plan.outcomeId, plan);
      planNodesByPlanId.set(plan.id, nodes);
      planEdgesByPlanId.set(plan.id, edges);

      return plan;
    },
    async getByOutcome(outcomeId) {
      return plansByOutcomeId.get(outcomeId) ?? null;
    },
    async listNodes(planId) {
      return [...(planNodesByPlanId.get(planId) ?? [])].sort(
        (left, right) => left.position - right.position
      );
    },
    async listEdges(planId) {
      return [...(planEdgesByPlanId.get(planId) ?? [])];
    }
  };

  const runsStore: RunStore = {
    async createFromPlan(input) {
      const plan = Array.from(plansByOutcomeId.values()).find(
        (candidate) => candidate.id === input.planId
      );

      if (!plan) {
        throw new Error(`Plan ${input.planId} does not exist.`);
      }

      if (plan.outcomeId !== input.outcomeId) {
        throw new Error(
          `Plan ${input.planId} belongs to ${plan.outcomeId}, not ${input.outcomeId}.`
        );
      }

      const run: StoredRun = {
        id: input.id,
        outcomeId: plan.outcomeId,
        planId: plan.id,
        status: "queued",
        createdAt: input.createdAt,
        updatedAt: input.updatedAt
      };
      const nodes = [...(planNodesByPlanId.get(plan.id) ?? [])].sort(
        (left, right) => left.position - right.position
      );
      const targetNodeIds = new Set(
        (planEdgesByPlanId.get(plan.id) ?? []).map((edge) => edge.to)
      );
      const steps = nodes.map((node) => ({
        id: `step_${input.id}_${node.id}`,
        runId: input.id,
        planNodeId: node.id,
        title: node.title,
        kind: node.kind,
        capability: node.capability,
        status: targetNodeIds.has(node.id) ? "pending" : "ready",
        position: node.position,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt
      })) satisfies StoredRunStep[];

      runsById.set(run.id, run);
      runStepsByRunId.set(run.id, steps);

      return run;
    },
    async getById(id) {
      return runsById.get(id) ?? null;
    },
    async listSteps(runId) {
      return [...(runStepsByRunId.get(runId) ?? [])].sort(
        (left, right) => left.position - right.position
      );
    },
    async appendEvent(input) {
      runEvents.push(input);
    },
    async updateStepStatus(input) {
      for (const steps of runStepsByRunId.values()) {
        const step = steps.find((candidate) => candidate.id === input.stepId);

        if (!step) {
          continue;
        }

        const updatedStep = {
          ...step,
          status: input.status,
          updatedAt: input.updatedAt
        };
        const updatedSteps = steps.map((candidate) =>
          candidate.id === input.stepId ? updatedStep : candidate
        );

        runStepsByRunId.set(updatedStep.runId, updatedSteps);
        return updatedStep;
      }

      return null;
    }
  };

  return {
    outcomesStore,
    plansStore,
    runsStore
  };
}

export function createInMemoryRepositories(): Repositories {
  const state = createInMemoryRepositoriesState();

  return {
    outcomes: state.outcomesStore,
    plans: state.plansStore,
    runs: state.runsStore
  };
}

export async function createDatabaseRepositories(
  connectionString: string
): Promise<Repositories> {
  const {
    OutcomeRepository,
    PlanRepository,
    RunRepository,
    createDatabaseClient
  } = await import("@computer-oss/db");
  const db = createDatabaseClient(connectionString);

  return {
    outcomes: new OutcomeRepository(db),
    plans: new PlanRepository(db),
    runs: new RunRepository(db)
  };
}
