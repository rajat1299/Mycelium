import type {
  AcquireWorkspaceLeaseInput,
  AppendRunEventInput,
  CreateArtifactInput,
  CreatePlanInput,
  CreateRunFromPlanInput,
  ReleaseReadyDependentsInput,
  ReleaseWorkspaceLeaseInput,
  StoredArtifact,
  StoredPlan,
  StoredPlanEdge,
  StoredPlanNode,
  StoredRun,
  StoredRunEvent,
  StoredRunStep,
  StoredWorkspaceLease,
  UpdateRunLifecycleStatusInput,
  UpdateRunStatusInput,
  UpdateStepStatusInput
} from "@computer-oss/db";
import type {
  CreateOutcomeMessageRequest,
  CreateOutcomeRequest,
  Outcome,
  OutcomeStatus
} from "@computer-oss/protocol";

export type CreateStoredOutcomeInput = CreateOutcomeRequest & { id: string };

export type AppendOutcomeMessageInput = CreateOutcomeMessageRequest & {
  id: string;
  outcomeId: string;
  createdAt: string;
};

export type UpdateOutcomeStatusInput = {
  id: string;
  status: OutcomeStatus;
  updatedAt: string;
};

export type OutcomeStore = {
  create(input: CreateStoredOutcomeInput): Promise<Outcome>;
  getById(id: string): Promise<Outcome | null>;
  listByWorkspace(workspaceId: string): Promise<Outcome[]>;
  updateStatus(input: UpdateOutcomeStatusInput): Promise<Outcome | null>;
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
  getLatestByOutcome(outcomeId: string): Promise<StoredRun | null>;
  listSteps(runId: string): Promise<StoredRunStep[]>;
  listReadySteps(runId: string): Promise<StoredRunStep[]>;
  appendEvent(input: AppendRunEventInput): Promise<void>;
  listEvents(runId: string, eventType?: string): Promise<StoredRunEvent[]>;
  updateLifecycleStatus(
    input: UpdateRunLifecycleStatusInput
  ): Promise<{ run: StoredRun; outcome: Outcome } | null>;
  updateStatus(input: UpdateRunStatusInput): Promise<StoredRun | null>;
  updateStepStatus(input: UpdateStepStatusInput): Promise<StoredRunStep | null>;
  releaseReadyDependents(
    input: ReleaseReadyDependentsInput
  ): Promise<StoredRunStep[]>;
};

export type ArtifactStore = {
  create(input: CreateArtifactInput): Promise<StoredArtifact>;
  listByRun(runId: string): Promise<StoredArtifact[]>;
  listByOutcome(outcomeId: string): Promise<StoredArtifact[]>;
};

export type WorkspaceLeaseStore = {
  acquire(input: AcquireWorkspaceLeaseInput): Promise<StoredWorkspaceLease>;
  getActiveByRun(runId: string): Promise<StoredWorkspaceLease | null>;
  release(input: ReleaseWorkspaceLeaseInput): Promise<StoredWorkspaceLease | null>;
};

export type Repositories = {
  outcomes: OutcomeStore;
  plans: PlanStore;
  runs: RunStore;
  artifacts: ArtifactStore;
  workspaceLeases: WorkspaceLeaseStore;
};

type InMemoryState = ReturnType<typeof createInMemoryRepositoriesState>;
type InMemoryDataState = {
  runStepsByRunId: Map<string, StoredRunStep[]>;
};

function compareRuns(left: StoredRun, right: StoredRun) {
  const createdDelta =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  const updatedDelta =
    new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();

  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareArtifacts(left: StoredArtifact, right: StoredArtifact) {
  const createdDelta =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

function getStoredRunStep(
  state: InMemoryDataState,
  stepId: string
): { runId: string; step: StoredRunStep } | null {
  for (const [runId, steps] of state.runStepsByRunId.entries()) {
    const step = steps.find((candidate) => candidate.id === stepId);

    if (step) {
      return { runId, step };
    }
  }

  return null;
}

function createInMemoryRepositoriesState() {
  const outcomes = new Map<string, Outcome>();
  const plansByOutcomeId = new Map<string, StoredPlan>();
  const planNodesByPlanId = new Map<string, StoredPlanNode[]>();
  const planEdgesByPlanId = new Map<string, StoredPlanEdge[]>();
  const runsById = new Map<string, StoredRun>();
  const runStepsByRunId = new Map<string, StoredRunStep[]>();
  const artifacts = new Map<string, StoredArtifact>();
  const workspaceLeasesByRunId = new Map<string, StoredWorkspaceLease>();
  const runEvents: AppendRunEventInput[] = [];

  const state = {
    outcomes,
    plansByOutcomeId,
    planNodesByPlanId,
    planEdgesByPlanId,
    runsById,
    runStepsByRunId,
    artifacts,
    workspaceLeasesByRunId,
    runEvents
  };

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
    async updateStatus(input) {
      const current = outcomes.get(input.id);

      if (!current) {
        return null;
      }

      const updated: Outcome = {
        ...current,
        status: input.status,
        updatedAt: input.updatedAt
      };

      outcomes.set(updated.id, updated);
      return updated;
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
        ...(node.instruction ? { instruction: node.instruction } : {}),
        ...(node.template ? { template: node.template } : {}),
        ...(node.expectedArtifactPath
          ? { expectedArtifactPath: node.expectedArtifactPath }
          : {}),
        ...(node.expectedArtifactKind
          ? { expectedArtifactKind: node.expectedArtifactKind }
          : {}),
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
        ...(node.instruction ? { instruction: node.instruction } : {}),
        ...(node.template ? { template: node.template } : {}),
        ...(node.expectedArtifactPath
          ? { expectedArtifactPath: node.expectedArtifactPath }
          : {}),
        ...(node.expectedArtifactKind
          ? { expectedArtifactKind: node.expectedArtifactKind }
          : {}),
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
    async getLatestByOutcome(outcomeId) {
      return (
        Array.from(runsById.values())
          .filter((run) => run.outcomeId === outcomeId)
          .sort(compareRuns)
          .at(-1) ?? null
      );
    },
    async listSteps(runId) {
      return [...(runStepsByRunId.get(runId) ?? [])].sort(
        (left, right) => left.position - right.position
      );
    },
    async listReadySteps(runId) {
      return [...(runStepsByRunId.get(runId) ?? [])]
        .filter((step) => step.status === "ready")
        .sort((left, right) => left.position - right.position);
    },
    async appendEvent(input) {
      runEvents.push(input);
    },
    async listEvents(runId, eventType) {
      return runEvents
        .filter(
          (event) =>
            event.runId === runId &&
            (eventType ? event.eventType === eventType : true)
        )
        .sort((left, right) => {
          const createdDelta =
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime();

          if (createdDelta !== 0) {
            return createdDelta;
          }

          return left.id.localeCompare(right.id);
        })
        .map((event) => ({
          ...event
        }));
    },
    async updateLifecycleStatus(input) {
      const run = runsById.get(input.runId);
      const outcome = outcomes.get(input.outcomeId);

      if (!run || !outcome) {
        return null;
      }

      if (run.outcomeId !== input.outcomeId) {
        throw new Error(
          `Run ${input.runId} belongs to ${run.outcomeId}, not ${input.outcomeId}.`
        );
      }

      const updatedRun: StoredRun = {
        ...run,
        status: input.runStatus,
        updatedAt: input.updatedAt
      };
      const updatedOutcome: Outcome = {
        ...outcome,
        status: input.outcomeStatus,
        updatedAt: input.updatedAt
      };

      runsById.set(updatedRun.id, updatedRun);
      outcomes.set(updatedOutcome.id, updatedOutcome);

      return {
        run: updatedRun,
        outcome: updatedOutcome
      };
    },
    async updateStatus(input) {
      const run = runsById.get(input.runId);

      if (!run) {
        return null;
      }

      const updatedRun: StoredRun = {
        ...run,
        status: input.status,
        updatedAt: input.updatedAt
      };

      runsById.set(updatedRun.id, updatedRun);
      return updatedRun;
    },
    async updateStepStatus(input) {
      const located = getStoredRunStep(state, input.stepId);

      if (!located) {
        return null;
      }

      const updatedStep: StoredRunStep = {
        ...located.step,
        status: input.status,
        updatedAt: input.updatedAt
      };
      const updatedSteps =
        runStepsByRunId.get(located.runId)?.map((candidate) =>
          candidate.id === input.stepId ? updatedStep : candidate
        ) ?? [];

      runStepsByRunId.set(located.runId, updatedSteps);
      return updatedStep;
    },
    async releaseReadyDependents(input) {
      const run = runsById.get(input.runId);

      if (!run) {
        throw new Error(`Run ${input.runId} does not exist.`);
      }

      const runSteps = [...(runStepsByRunId.get(input.runId) ?? [])];
      const completedStep = runSteps.find((step) => step.id === input.completedStepId);

      if (!completedStep) {
        throw new Error(
          `Step ${input.completedStepId} does not belong to run ${input.runId}.`
        );
      }

      const planEdges = planEdgesByPlanId.get(run.planId) ?? [];
      const dependentNodeIds = planEdges
        .filter((edge) => edge.from === completedStep.planNodeId)
        .map((edge) => edge.to);
      const releasedSteps: StoredRunStep[] = [];

      for (const dependentNodeId of dependentNodeIds) {
        const dependentStep = runSteps.find(
          (step) => step.planNodeId === dependentNodeId
        );

        if (!dependentStep || dependentStep.status !== "pending") {
          continue;
        }

        const parentNodeIds = planEdges
          .filter((edge) => edge.to === dependentNodeId)
          .map((edge) => edge.from);
        const allParentsCompleted = parentNodeIds.every((parentNodeId) =>
          runSteps.some(
            (step) =>
              step.planNodeId === parentNodeId && step.status === "completed"
          )
        );

        if (!allParentsCompleted) {
          continue;
        }

        const updatedStep: StoredRunStep = {
          ...dependentStep,
          status: "ready",
          updatedAt: input.updatedAt
        };
        const updatedRunSteps = runStepsByRunId.get(input.runId)?.map((step) =>
          step.id === dependentStep.id && step.status === "pending"
            ? updatedStep
            : step
        );

        if (!updatedRunSteps) {
          continue;
        }

        const persistedStep = updatedRunSteps.find(
          (step) => step.id === dependentStep.id
        );

        if (!persistedStep || persistedStep.status !== "ready") {
          continue;
        }

        runStepsByRunId.set(input.runId, updatedRunSteps);
        const staleStepIndex = runSteps.findIndex((step) => step.id === dependentStep.id);

        if (staleStepIndex >= 0) {
          runSteps[staleStepIndex] = persistedStep;
        }

        releasedSteps.push(persistedStep);
      }

      return releasedSteps.sort((left, right) => left.position - right.position);
    }
  };

  const artifactsStore: ArtifactStore = {
    async create(input) {
      const run = input.runId ? runsById.get(input.runId) : null;

      if (input.runId && !run) {
        throw new Error(`Run ${input.runId} does not exist.`);
      }

      if (run && run.outcomeId !== input.outcomeId) {
        throw new Error(
          `Run ${input.runId} belongs to ${run.outcomeId}, not ${input.outcomeId}.`
        );
      }

      if (input.stepId) {
        if (!input.runId) {
          throw new Error("Artifact step scope requires a runId.");
        }

        const located = getStoredRunStep(state, input.stepId);

        if (!located) {
          throw new Error(`Step ${input.stepId} does not exist.`);
        }

        if (located.runId !== input.runId) {
          throw new Error(
            `Step ${input.stepId} belongs to ${located.runId}, not ${input.runId}.`
          );
        }
      }

      const artifact: StoredArtifact = {
        id: input.id,
        outcomeId: input.outcomeId,
        runId: input.runId ?? null,
        stepId: input.stepId ?? null,
        kind: input.kind,
        relativePath: input.relativePath,
        size: input.size,
        metadata: input.metadata,
        createdAt: input.createdAt
      };

      artifacts.set(artifact.id, artifact);
      return artifact;
    },
    async listByRun(runId) {
      return Array.from(artifacts.values())
        .filter((artifact) => artifact.runId === runId)
        .sort(compareArtifacts);
    },
    async listByOutcome(outcomeId) {
      return Array.from(artifacts.values())
        .filter((artifact) => artifact.outcomeId === outcomeId)
        .sort(compareArtifacts);
    }
  };

  const workspaceLeasesStore: WorkspaceLeaseStore = {
    async acquire(input) {
      const run = runsById.get(input.runId);

      if (!run) {
        throw new Error(`Run ${input.runId} does not exist.`);
      }

      const existing = workspaceLeasesByRunId.get(input.runId);

      if (existing && existing.releasedAt === null) {
        throw new Error(`Active workspace lease already exists for run ${input.runId}.`);
      }

      const lease: StoredWorkspaceLease = {
        runId: input.runId,
        rootPath: input.rootPath,
        inputPath: input.inputPath,
        artifactsPath: input.artifactsPath,
        logsPath: input.logsPath,
        acquiredAt: input.acquiredAt,
        releasedAt: null
      };

      workspaceLeasesByRunId.set(input.runId, lease);
      return lease;
    },
    async getActiveByRun(runId) {
      const lease = workspaceLeasesByRunId.get(runId);
      return lease?.releasedAt === null ? lease : null;
    },
    async release(input) {
      const lease = workspaceLeasesByRunId.get(input.runId);

      if (!lease) {
        return null;
      }

      if (lease.releasedAt !== null) {
        return lease;
      }

      const updatedLease: StoredWorkspaceLease = {
        ...lease,
        releasedAt: input.releasedAt
      };

      workspaceLeasesByRunId.set(input.runId, updatedLease);
      return updatedLease;
    }
  };

  return {
    outcomesStore,
    plansStore,
    runsStore,
    artifactsStore,
    workspaceLeasesStore
  };
}

export function createInMemoryRepositories(): Repositories {
  const state = createInMemoryRepositoriesState();

  return {
    outcomes: state.outcomesStore,
    plans: state.plansStore,
    runs: state.runsStore,
    artifacts: state.artifactsStore,
    workspaceLeases: state.workspaceLeasesStore
  };
}

export async function createDatabaseRepositories(
  connectionString: string
): Promise<Repositories> {
  const {
    ArtifactRepository,
    OutcomeRepository,
    PlanRepository,
    RunRepository,
    WorkspaceLeaseRepository,
    createDatabaseClient
  } = await import("@computer-oss/db");
  const db = createDatabaseClient(connectionString);

  return {
    outcomes: new OutcomeRepository(db),
    plans: new PlanRepository(db),
    runs: new RunRepository(db),
    artifacts: new ArtifactRepository(db),
    workspaceLeases: new WorkspaceLeaseRepository(db)
  };
}
