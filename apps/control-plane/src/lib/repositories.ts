import type {
  AcquireWorkspaceLeaseInput,
  AppendRunEventInput,
  CreateAuthProfileInput,
  CreateArtifactInput,
  CreatePlanInput,
  CreateRunFromPlanInput,
  CreateWorkspaceCredentialInput,
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
  UpdateAuthProfileInput,
  UpdateRunLifecycleStatusInput,
  UpdateRunStatusInput,
  UpdateStepRouteInput,
  UpdateStepStatusInput,
  UpdateWorkspaceCredentialInput
} from "@computer-oss/db";
import type {
  AuthProfile,
  CreateOutcomeMessageRequest,
  CreateOutcomeRequest,
  Outcome,
  OutcomeStatus,
  RouterPolicy,
  WorkspaceCredentialMetadata
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
  updateStepRoute(input: UpdateStepRouteInput): Promise<StoredRunStep | null>;
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

export type WorkspaceCredentialStore = {
  create(input: CreateWorkspaceCredentialInput): Promise<WorkspaceCredentialMetadata>;
  getById(id: string): Promise<WorkspaceCredentialMetadata | null>;
  listByWorkspace(workspaceId: string): Promise<WorkspaceCredentialMetadata[]>;
  update(
    input: UpdateWorkspaceCredentialInput
  ): Promise<WorkspaceCredentialMetadata | null>;
  delete(id: string): Promise<boolean>;
};

export type AuthProfileStore = {
  create(input: CreateAuthProfileInput): Promise<AuthProfile>;
  getById(id: string): Promise<AuthProfile | null>;
  listByWorkspace(workspaceId: string): Promise<AuthProfile[]>;
  update(input: UpdateAuthProfileInput): Promise<AuthProfile | null>;
  delete(id: string): Promise<boolean>;
};

export type RouterPolicyStore = {
  getByWorkspace(workspaceId: string): Promise<RouterPolicy | null>;
  upsert(input: RouterPolicy): Promise<RouterPolicy>;
};

export type Repositories = {
  outcomes: OutcomeStore;
  plans: PlanStore;
  runs: RunStore;
  artifacts: ArtifactStore;
  workspaceLeases: WorkspaceLeaseStore;
  workspaceCredentials: WorkspaceCredentialStore;
  authProfiles: AuthProfileStore;
  routerPolicy: RouterPolicyStore;
};

type InMemoryState = ReturnType<typeof createInMemoryRepositoriesState>;
type InMemoryDataState = {
  runStepsByRunId: Map<string, StoredRunStep[]>;
  workspaceCredentialsById: Map<string, CreateWorkspaceCredentialInput>;
  authProfilesById: Map<string, AuthProfile>;
  routerPoliciesByWorkspaceId: Map<string, RouterPolicy>;
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

function compareWorkspaceCredentials(
  left: WorkspaceCredentialMetadata,
  right: WorkspaceCredentialMetadata
) {
  const createdDelta =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareAuthProfiles(left: AuthProfile, right: AuthProfile) {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  const createdDelta =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

function comparePolicyCandidates(
  left: RouterPolicy["candidates"][number],
  right: RouterPolicy["candidates"][number]
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

function mapWorkspaceCredentialMetadata(
  credential: CreateWorkspaceCredentialInput
): WorkspaceCredentialMetadata {
  return {
    id: credential.id,
    workspaceId: credential.workspaceId,
    providerId: credential.providerId,
    label: credential.label,
    status: credential.status,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
    lastValidatedAt: credential.lastValidatedAt
  };
}

function validateCredentialOwnership(
  credential: CreateWorkspaceCredentialInput | undefined,
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

function foreignKeyDeleteError(
  table: string,
  constraint: string,
  referencingTable: string
) {
  return new Error(
    `update or delete on table "${table}" violates foreign key constraint "${constraint}" on table "${referencingTable}"`
  );
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
  const workspaceCredentialsById = new Map<string, CreateWorkspaceCredentialInput>();
  const authProfilesById = new Map<string, AuthProfile>();
  const routerPoliciesByWorkspaceId = new Map<string, RouterPolicy>();
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
    workspaceCredentialsById,
    authProfilesById,
    routerPoliciesByWorkspaceId,
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
    async updateStepRoute(input) {
      const located = getStoredRunStep(state, input.stepId);

      if (!located) {
        return null;
      }

      if (located.step.capability !== input.route.capability) {
        throw new Error(
          `Route capability ${input.route.capability} does not match step capability ${located.step.capability}.`
        );
      }

      const updatedStep: StoredRunStep = {
        ...located.step,
        routeProviderId: input.route.providerId,
        routeModelId: input.route.modelId,
        routeAuthProfileId: input.route.authProfileId,
        routePolicyVersion: input.route.policyVersion,
        routeStatus: input.route.status,
        routeReason: input.route.reason,
        routeResolvedAt: input.route.resolvedAt
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

  const workspaceCredentialsStore: WorkspaceCredentialStore = {
    async create(input) {
      if (workspaceCredentialsById.has(input.id)) {
        throw new Error(
          'duplicate key value violates unique constraint "workspace_credentials_pkey"'
        );
      }

      workspaceCredentialsById.set(input.id, { ...input });
      return mapWorkspaceCredentialMetadata(input);
    },
    async getById(id) {
      const credential = workspaceCredentialsById.get(id);
      return credential ? mapWorkspaceCredentialMetadata(credential) : null;
    },
    async listByWorkspace(workspaceId) {
      return Array.from(workspaceCredentialsById.values())
        .filter((credential) => credential.workspaceId === workspaceId)
        .map(mapWorkspaceCredentialMetadata)
        .sort(compareWorkspaceCredentials);
    },
    async update(input) {
      const current = workspaceCredentialsById.get(input.id);

      if (!current) {
        return null;
      }

      const updated: CreateWorkspaceCredentialInput = {
        ...current,
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
          ? { lastValidatedAt: input.lastValidatedAt }
          : {}),
        updatedAt: input.updatedAt
      };

      workspaceCredentialsById.set(updated.id, updated);
      return mapWorkspaceCredentialMetadata(updated);
    },
    async delete(id) {
      if (
        Array.from(authProfilesById.values()).some(
          (profile) => profile.credentialId === id
        )
      ) {
        throw foreignKeyDeleteError(
          "workspace_credentials",
          "auth_profiles_credential_id_fkey",
          "auth_profiles"
        );
      }

      return workspaceCredentialsById.delete(id);
    }
  };

  const authProfilesStore: AuthProfileStore = {
    async create(input) {
      if (authProfilesById.has(input.id)) {
        throw new Error(
          'duplicate key value violates unique constraint "auth_profiles_pkey"'
        );
      }

      const credential = workspaceCredentialsById.get(input.credentialId);
      validateCredentialOwnership(
        credential,
        input.workspaceId,
        input.providerId,
        input.credentialId
      );

      const profile: AuthProfile = { ...input };
      authProfilesById.set(profile.id, profile);
      return profile;
    },
    async getById(id) {
      return authProfilesById.get(id) ?? null;
    },
    async listByWorkspace(workspaceId) {
      return Array.from(authProfilesById.values())
        .filter((profile) => profile.workspaceId === workspaceId)
        .sort(compareAuthProfiles);
    },
    async update(input) {
      const current = authProfilesById.get(input.id);

      if (!current) {
        return null;
      }

      const nextCredentialId = input.credentialId ?? current.credentialId;

      if (nextCredentialId !== current.credentialId) {
        const credential = workspaceCredentialsById.get(nextCredentialId);
        validateCredentialOwnership(
          credential,
          current.workspaceId,
          current.providerId,
          nextCredentialId
        );
      }

      const updated: AuthProfile = {
        ...current,
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.credentialId !== undefined
          ? { credentialId: input.credentialId }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.cooldownUntil !== undefined
          ? { cooldownUntil: input.cooldownUntil }
          : {}),
        ...(input.lastValidatedAt !== undefined
          ? { lastValidatedAt: input.lastValidatedAt }
          : {}),
        updatedAt: input.updatedAt
      };

      authProfilesById.set(updated.id, updated);
      return updated;
    },
    async delete(id) {
      if (
        Array.from(routerPoliciesByWorkspaceId.values()).some((policy) =>
          policy.candidates.some((candidate) => candidate.authProfileId === id)
        )
      ) {
        throw foreignKeyDeleteError(
          "auth_profiles",
          "router_policy_candidates_auth_profile_id_fkey",
          "router_policy_candidates"
        );
      }

      return authProfilesById.delete(id);
    }
  };

  const routerPolicyStore: RouterPolicyStore = {
    async getByWorkspace(workspaceId) {
      return routerPoliciesByWorkspaceId.get(workspaceId) ?? null;
    },
    async upsert(input) {
      for (const candidate of input.candidates) {
        if (!candidate.authProfileId) {
          continue;
        }

        const profile = authProfilesById.get(candidate.authProfileId);

        if (!profile) {
          throw new Error(`Auth profile ${candidate.authProfileId} does not exist.`);
        }

        if (profile.workspaceId !== input.workspaceId) {
          throw new Error(
            `Auth profile ${candidate.authProfileId} belongs to workspace ${profile.workspaceId}, not ${input.workspaceId}.`
          );
        }

        if (profile.providerId !== candidate.providerId) {
          throw new Error(
            `Auth profile ${candidate.authProfileId} belongs to provider ${profile.providerId}, not ${candidate.providerId}.`
          );
        }
      }

      const stored: RouterPolicy = {
        workspaceId: input.workspaceId,
        version: input.version,
        updatedAt: input.updatedAt,
        candidates: [...input.candidates].sort(comparePolicyCandidates)
      };

      routerPoliciesByWorkspaceId.set(input.workspaceId, stored);
      return stored;
    }
  };

  return {
    outcomesStore,
    plansStore,
    runsStore,
    artifactsStore,
    workspaceLeasesStore,
    workspaceCredentialsStore,
    authProfilesStore,
    routerPolicyStore
  };
}

export function createInMemoryRepositories(): Repositories {
  const state = createInMemoryRepositoriesState();

  return {
    outcomes: state.outcomesStore,
    plans: state.plansStore,
    runs: state.runsStore,
    artifacts: state.artifactsStore,
    workspaceLeases: state.workspaceLeasesStore,
    workspaceCredentials: state.workspaceCredentialsStore,
    authProfiles: state.authProfilesStore,
    routerPolicy: state.routerPolicyStore
  };
}

export async function createDatabaseRepositories(
  connectionString: string
): Promise<Repositories> {
  const {
    AuthProfileRepository,
    ArtifactRepository,
    OutcomeRepository,
    PlanRepository,
    RouterPolicyRepository,
    RunRepository,
    WorkspaceCredentialRepository,
    WorkspaceLeaseRepository,
    createDatabaseClient
  } = await import("@computer-oss/db");
  const db = createDatabaseClient(connectionString);

  return {
    outcomes: new OutcomeRepository(db),
    plans: new PlanRepository(db),
    runs: new RunRepository(db),
    artifacts: new ArtifactRepository(db),
    workspaceLeases: new WorkspaceLeaseRepository(db),
    workspaceCredentials: new WorkspaceCredentialRepository(db),
    authProfiles: new AuthProfileRepository(db),
    routerPolicy: new RouterPolicyRepository(db)
  };
}
