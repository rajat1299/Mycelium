import type {
  AppendAuditEventInput,
  CreateArtifactLineageEdgeInput,
  AcquireWorkspaceLeaseInput,
  AppendRunEventInput,
  BindConversationInput,
  CleanupStaleRemoteWorkersInput,
  CreatePendingApprovalInput,
  CreateAuthProfileInput,
  CreateArtifactInput,
  CreateCheckpointInput,
  CreatePlanInput,
  CreateRunFromPlanInput,
  CreateScheduleInput,
  GetBindingByExternalConversationInput,
  RecordScheduleFireInput,
  RecordRemoteWorkerHeartbeatInput,
  StoredExternalConversationBinding,
  StoredMessagingConnection,
  UpdateRemoteWorkerSessionStateInput,
  ListApprovalsInput,
  RestoreFromCheckpointInput,
  StoredRemoteWorker,
  StoredSchedule,
  StoredScheduleFire,
  CreateWorkspaceCredentialInput,
  ReleaseReadyDependentsInput,
  ReleaseWorkspaceLeaseInput,
  ResolveApprovalInput,
  StoredApproval,
  StoredArtifact,
  StoredArtifactLineageEdge,
  StoredAuditEvent,
  StoredCheckpoint,
  StoredPlan,
  StoredPlanEdge,
  StoredPlanNode,
  StoredRun,
  StoredRunEvent,
  StoredRunStep,
  UpsertRemoteWorkerInput,
  StoredWorkspaceLease,
  AssignStepToWorkerInput,
  ReleaseStepWorkerAssignmentInput,
  UpdateScheduleInput,
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
  ExternalConversationBinding,
  MessagingConnection,
  Outcome,
  OutcomeStatus,
  RemoteWorker,
  RouterPolicy,
  Schedule,
  ScheduleFireSummary,
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
  listByStatuses(statuses: StoredRun["status"][]): Promise<StoredRun[]>;
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
  assignStepToWorker(
    input: AssignStepToWorkerInput
  ): Promise<StoredRunStep | null>;
  releaseStepWorkerAssignment(
    input: ReleaseStepWorkerAssignmentInput
  ): Promise<StoredRunStep | null>;
  releaseReadyDependents(
    input: ReleaseReadyDependentsInput
  ): Promise<StoredRunStep[]>;
  restoreFromCheckpoint(
    input: RestoreFromCheckpointInput
  ): Promise<{ run: StoredRun; steps: StoredRunStep[] } | null>;
};

export type ArtifactStore = {
  create(input: CreateArtifactInput): Promise<StoredArtifact>;
  listByRun(runId: string): Promise<StoredArtifact[]>;
  listByOutcome(outcomeId: string): Promise<StoredArtifact[]>;
};

export type ApprovalStore = {
  createPending(input: CreatePendingApprovalInput): Promise<StoredApproval>;
  getById(id: string): Promise<StoredApproval | null>;
  listByWorkspace(input: ListApprovalsInput): Promise<StoredApproval[]>;
  cancel(input: {
    approvalId: string;
    resolvedAt: string;
    resolutionNote: string | null;
  }): Promise<StoredApproval | null>;
  resolve(
    input: ResolveApprovalInput
  ): Promise<
    | {
        approval: StoredApproval;
        step: StoredRunStep;
        run: StoredRun;
        outcome: Outcome;
      }
    | null
  >;
};

export type ArtifactLineageStore = {
  createMany(
    inputs: CreateArtifactLineageEdgeInput[]
  ): Promise<StoredArtifactLineageEdge[]>;
  listByRun(runId: string): Promise<StoredArtifactLineageEdge[]>;
  listByArtifact(artifactId: string): Promise<StoredArtifactLineageEdge[]>;
};

export type CheckpointRepositoryStore = {
  create(input: CreateCheckpointInput): Promise<StoredCheckpoint>;
  getById(id: string): Promise<StoredCheckpoint | null>;
  listByRun(runId: string): Promise<StoredCheckpoint[]>;
  getLatestResumableByRun(runId: string): Promise<StoredCheckpoint | null>;
};

export type AuditEventStore = {
  append(input: AppendAuditEventInput): Promise<StoredAuditEvent>;
  listByRun(runId: string): Promise<StoredAuditEvent[]>;
};

export type WorkspaceLeaseStore = {
  acquire(input: AcquireWorkspaceLeaseInput): Promise<StoredWorkspaceLease>;
  getActiveByRun(runId: string): Promise<StoredWorkspaceLease | null>;
  release(input: ReleaseWorkspaceLeaseInput): Promise<StoredWorkspaceLease | null>;
};

export type RemoteWorkerStore = {
  upsert(input: UpsertRemoteWorkerInput): Promise<StoredRemoteWorker>;
  getById(id: string): Promise<StoredRemoteWorker | null>;
  getBySession(sessionId: string): Promise<StoredRemoteWorker | null>;
  listByWorkspace(workspaceId: string): Promise<StoredRemoteWorker[]>;
  recordHeartbeat(
    input: RecordRemoteWorkerHeartbeatInput
  ): Promise<StoredRemoteWorker | null>;
  updateSessionState(
    input: UpdateRemoteWorkerSessionStateInput
  ): Promise<StoredRemoteWorker | null>;
  cleanupStaleSessions(
    input: CleanupStaleRemoteWorkersInput
  ): Promise<StoredRemoteWorker[]>;
  delete(id: string): Promise<boolean>;
};

export type ScheduleStore = {
  create(input: CreateScheduleInput): Promise<StoredSchedule>;
  getById(id: string): Promise<StoredSchedule | null>;
  listByWorkspace(workspaceId: string): Promise<StoredSchedule[]>;
  listAll(): Promise<StoredSchedule[]>;
  update(input: UpdateScheduleInput): Promise<StoredSchedule | null>;
  recordFire(input: RecordScheduleFireInput): Promise<StoredScheduleFire>;
  listFiresBySchedule(scheduleId: string): Promise<StoredScheduleFire[]>;
  delete(id: string): Promise<boolean>;
};

export type MessagingStore = {
  upsertConnection(
    input: StoredMessagingConnection
  ): Promise<StoredMessagingConnection>;
  getConnectionById(id: string): Promise<StoredMessagingConnection | null>;
  listConnectionsByWorkspace(
    workspaceId: string
  ): Promise<StoredMessagingConnection[]>;
  bindConversation(
    input: BindConversationInput
  ): Promise<StoredExternalConversationBinding>;
  getBindingByExternalConversation(
    input: GetBindingByExternalConversationInput
  ): Promise<StoredExternalConversationBinding | null>;
};

export type WorkspaceCredentialStore = {
  create(input: CreateWorkspaceCredentialInput): Promise<WorkspaceCredentialMetadata>;
  getById(id: string): Promise<WorkspaceCredentialMetadata | null>;
  getStoredById(id: string): Promise<CreateWorkspaceCredentialInput | null>;
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
  checkpoints: CheckpointRepositoryStore;
  auditEvents: AuditEventStore;
  approvals: ApprovalStore;
  artifactLineage: ArtifactLineageStore;
  workspaceLeases: WorkspaceLeaseStore;
  remoteWorkers: RemoteWorkerStore;
  schedules: ScheduleStore;
  messaging: MessagingStore;
  workspaceCredentials: WorkspaceCredentialStore;
  authProfiles: AuthProfileStore;
  routerPolicy: RouterPolicyStore;
};

type InMemoryState = ReturnType<typeof createInMemoryRepositoriesState>;
type InMemoryDataState = {
  runStepsByRunId: Map<string, StoredRunStep[]>;
  checkpointsById: Map<string, StoredCheckpoint>;
  auditEventsById: Map<string, StoredAuditEvent>;
  approvalsById: Map<string, StoredApproval>;
  artifactLineageEdgesById: Map<string, StoredArtifactLineageEdge>;
  remoteWorkersById: Map<string, StoredRemoteWorker>;
  schedulesById: Map<string, StoredSchedule>;
  scheduleFiresById: Map<string, StoredScheduleFire>;
  messagingConnectionsById: Map<string, StoredMessagingConnection>;
  conversationBindingsById: Map<string, StoredExternalConversationBinding>;
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

function compareCheckpointsNewestFirst(left: StoredCheckpoint, right: StoredCheckpoint) {
  const sequenceDelta = right.sequence - left.sequence;

  if (sequenceDelta !== 0) {
    return sequenceDelta;
  }

  const createdDelta =
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return right.id.localeCompare(left.id);
}

function compareAuditEvents(left: StoredAuditEvent, right: StoredAuditEvent) {
  const sequenceDelta = left.sequence - right.sequence;

  if (sequenceDelta !== 0) {
    return sequenceDelta;
  }

  const createdDelta =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareApprovals(left: StoredApproval, right: StoredApproval) {
  const requestedDelta =
    new Date(left.requestedAt).getTime() - new Date(right.requestedAt).getTime();

  if (requestedDelta !== 0) {
    return requestedDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareArtifactLineageEdges(
  left: StoredArtifactLineageEdge,
  right: StoredArtifactLineageEdge
) {
  const createdDelta =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareRemoteWorkers(left: RemoteWorker, right: RemoteWorker) {
  const updatedDelta =
    new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();

  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareSchedules(left: Schedule, right: Schedule) {
  const createdDelta =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareScheduleFires(left: ScheduleFireSummary, right: ScheduleFireSummary) {
  const scheduledDelta =
    new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime();

  if (scheduledDelta !== 0) {
    return scheduledDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareMessagingConnections(
  left: MessagingConnection,
  right: MessagingConnection
) {
  if (left.channel !== right.channel) {
    return left.channel.localeCompare(right.channel);
  }

  const updatedDelta =
    new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();

  if (updatedDelta !== 0) {
    return updatedDelta;
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

function messagingConversationKey(input: {
  channel: string;
  externalWorkspaceId: string;
  conversationId: string;
  threadId: string | null;
}) {
  return `${input.channel}:${input.externalWorkspaceId}:${input.conversationId}:${input.threadId ?? ""}`;
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
  const checkpointsById = new Map<string, StoredCheckpoint>();
  const auditEventsById = new Map<string, StoredAuditEvent>();
  const approvalsById = new Map<string, StoredApproval>();
  const artifactLineageEdgesById = new Map<string, StoredArtifactLineageEdge>();
  const remoteWorkersById = new Map<string, StoredRemoteWorker>();
  const schedulesById = new Map<string, StoredSchedule>();
  const scheduleFiresById = new Map<string, StoredScheduleFire>();
  const messagingConnectionsById = new Map<string, StoredMessagingConnection>();
  const conversationBindingsById = new Map<
    string,
    StoredExternalConversationBinding
  >();
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
    checkpointsById,
    auditEventsById,
    approvalsById,
    artifactLineageEdgesById,
    remoteWorkersById,
    schedulesById,
    scheduleFiresById,
    messagingConnectionsById,
    conversationBindingsById,
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
        ...(node.approvalRequirement
          ? { approvalRequirement: node.approvalRequirement }
          : {}),
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
        latestCheckpointId: null,
        resumable: false,
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
        ...(node.approvalRequirement
          ? { approvalRequirement: node.approvalRequirement }
          : {}),
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
    async listByStatuses(statuses) {
      const allowed = new Set(statuses);

      return Array.from(runsById.values())
        .filter((run) => allowed.has(run.status))
        .sort(compareRuns);
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
    async assignStepToWorker(input) {
      const located = getStoredRunStep(state, input.stepId);

      if (!located) {
        return null;
      }

      const worker = remoteWorkersById.get(input.workerId);

      if (!worker) {
        throw new Error(`Remote worker ${input.workerId} does not exist.`);
      }

      if (worker.sessionId !== input.workerSessionId) {
        throw new Error(
          `Remote worker ${input.workerId} session ${input.workerSessionId} does not match active session ${worker.sessionId}.`
        );
      }

      if (
        (located.step.remoteWorkerId &&
          located.step.remoteWorkerId !== input.workerId) ||
        (located.step.remoteWorkerSessionId &&
          located.step.remoteWorkerSessionId !== input.workerSessionId)
      ) {
        throw new Error(
          `Step ${input.stepId} is already assigned to worker ${located.step.remoteWorkerId}.`
        );
      }

      const updatedStep: StoredRunStep = {
        ...located.step,
        executionTarget: "remote_worker",
        remoteWorkerId: input.workerId,
        remoteWorkerSessionId: input.workerSessionId,
        remoteExecutionAttemptId: input.attemptId,
        remoteAssignedAt: input.assignedAt,
        updatedAt: input.updatedAt
      };
      const updatedSteps =
        runStepsByRunId.get(located.runId)?.map((candidate) =>
          candidate.id === input.stepId ? updatedStep : candidate
        ) ?? [];

      runStepsByRunId.set(located.runId, updatedSteps);
      return updatedStep;
    },
    async releaseStepWorkerAssignment(input) {
      const located = getStoredRunStep(state, input.stepId);

      if (!located) {
        return null;
      }

      if (
        located.step.remoteWorkerId !== input.workerId ||
        located.step.remoteWorkerSessionId !== input.workerSessionId ||
        located.step.remoteExecutionAttemptId !== input.attemptId
      ) {
        return null;
      }

      const updatedStep: StoredRunStep = {
        ...located.step,
        executionTarget: null,
        remoteWorkerId: null,
        remoteWorkerSessionId: null,
        remoteExecutionAttemptId: null,
        remoteAssignedAt: null,
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
    },
    async restoreFromCheckpoint(input) {
      const run = runsById.get(input.runId);

      if (!run) {
        return null;
      }

      const checkpoint = checkpointsById.get(input.checkpointId);

      if (!checkpoint) {
        throw new Error(`Checkpoint ${input.checkpointId} does not exist.`);
      }

      if (checkpoint.runId !== input.runId) {
        throw new Error(
          `Checkpoint ${input.checkpointId} belongs to ${checkpoint.runId}, not ${input.runId}.`
        );
      }

      const payload = input.payload as {
        run: { id: string; outcomeId: string; workspaceId: string };
        steps: Array<{ stepId: string; status: StoredRunStep["status"] }>;
      };
      const outcome = outcomes.get(run.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${run.outcomeId} does not exist.`);
      }

      if (payload.run.id !== input.runId) {
        throw new Error(
          `Checkpoint payload belongs to ${payload.run.id}, not ${input.runId}.`
        );
      }

      if (payload.run.outcomeId !== run.outcomeId) {
        throw new Error(
          `Checkpoint payload outcome ${payload.run.outcomeId} does not match ${run.outcomeId}.`
        );
      }

      if (payload.run.workspaceId !== outcome.workspaceId) {
        throw new Error(
          `Checkpoint payload workspace ${payload.run.workspaceId} does not match ${outcome.workspaceId}.`
        );
      }

      const existingSteps = [...(runStepsByRunId.get(input.runId) ?? [])];
      const payloadStepIds = new Set(payload.steps.map((step) => step.stepId));

      if (existingSteps.some((step) => !payloadStepIds.has(step.id))) {
        throw new Error(
          `Checkpoint payload for run ${input.runId} does not cover every persisted step.`
        );
      }

      const restoredSteps = existingSteps.map((step) => {
        const payloadStep = payload.steps.find(
          (candidate) => candidate.stepId === step.id
        );

        if (!payloadStep) {
          throw new Error(
            `Checkpoint payload step ${step.id} does not belong to run ${input.runId}.`
          );
        }

        return {
          ...step,
          status: payloadStep.status,
          updatedAt: input.updatedAt
        };
      });
      const restoredRun: StoredRun = {
        ...run,
        latestCheckpointId: input.checkpointId,
        resumable: checkpoint.resumable,
        updatedAt: input.updatedAt
      };

      runStepsByRunId.set(input.runId, restoredSteps);
      runsById.set(input.runId, restoredRun);

      return {
        run: restoredRun,
        steps: restoredSteps.sort((left, right) => left.position - right.position)
      };
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

  const checkpointsStore: CheckpointRepositoryStore = {
    async create(input) {
      const run = runsById.get(input.runId);

      if (!run) {
        throw new Error(`Run ${input.runId} does not exist.`);
      }

      if (run.outcomeId !== input.outcomeId) {
        throw new Error(
          `Run ${input.runId} belongs to ${run.outcomeId}, not ${input.outcomeId}.`
        );
      }

      const outcome = outcomes.get(input.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${input.outcomeId} does not exist.`);
      }

      if (outcome.workspaceId !== input.workspaceId) {
        throw new Error(
          `Outcome ${input.outcomeId} belongs to ${outcome.workspaceId}, not ${input.workspaceId}.`
        );
      }

      if (input.stepId) {
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

      const latestRecordedCheckpoint = Array.from(checkpointsById.values())
        .filter((checkpoint) => checkpoint.runId === input.runId)
        .sort(compareCheckpointsNewestFirst)
        .at(0);
      const created: StoredCheckpoint = {
        ...input
      };

      checkpointsById.set(created.id, created);

      if (
        !latestRecordedCheckpoint ||
        created.sequence > latestRecordedCheckpoint.sequence
      ) {
        runsById.set(input.runId, {
          ...run,
          latestCheckpointId: created.id,
          resumable: created.resumable,
          updatedAt: input.createdAt
        });
      }

      return created;
    },
    async getById(id) {
      return checkpointsById.get(id) ?? null;
    },
    async listByRun(runId) {
      return Array.from(checkpointsById.values())
        .filter((checkpoint) => checkpoint.runId === runId)
        .sort(compareCheckpointsNewestFirst);
    },
    async getLatestResumableByRun(runId) {
      return (
        Array.from(checkpointsById.values())
          .filter((checkpoint) => checkpoint.runId === runId && checkpoint.resumable)
          .sort(compareCheckpointsNewestFirst)
          .at(0) ?? null
      );
    }
  };

  const auditEventsStore: AuditEventStore = {
    async append(input) {
      const run = runsById.get(input.runId);

      if (!run) {
        throw new Error(`Run ${input.runId} does not exist.`);
      }

      if (run.outcomeId !== input.outcomeId) {
        throw new Error(
          `Run ${input.runId} belongs to ${run.outcomeId}, not ${input.outcomeId}.`
        );
      }

      const outcome = outcomes.get(input.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${input.outcomeId} does not exist.`);
      }

      if (outcome.workspaceId !== input.workspaceId) {
        throw new Error(
          `Outcome ${input.outcomeId} belongs to ${outcome.workspaceId}, not ${input.workspaceId}.`
        );
      }

      if (input.stepId) {
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

      if (input.checkpointId) {
        const checkpoint = checkpointsById.get(input.checkpointId);

        if (!checkpoint) {
          throw new Error(`Checkpoint ${input.checkpointId} does not exist.`);
        }

        if (checkpoint.runId !== input.runId) {
          throw new Error(
            `Checkpoint ${input.checkpointId} belongs to ${checkpoint.runId}, not ${input.runId}.`
          );
        }
      }

      auditEventsById.set(input.id, input);
      return input;
    },
    async listByRun(runId) {
      return Array.from(auditEventsById.values())
        .filter((event) => event.runId === runId)
        .sort(compareAuditEvents);
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

      const hasWorkerOwnership =
        input.remoteWorkerId !== undefined || input.remoteWorkerSessionId !== undefined;

      if (hasWorkerOwnership) {
        if (!input.remoteWorkerId || !input.remoteWorkerSessionId) {
          throw new Error("Remote worker leases require both remoteWorkerId and remoteWorkerSessionId.");
        }

        const worker = remoteWorkersById.get(input.remoteWorkerId);

        if (!worker) {
          throw new Error(`Remote worker ${input.remoteWorkerId} does not exist.`);
        }

        if (worker.sessionId !== input.remoteWorkerSessionId) {
          throw new Error(
            `Remote worker ${input.remoteWorkerId} session ${input.remoteWorkerSessionId} does not match active session ${worker.sessionId}.`
          );
        }
      }

      const lease: StoredWorkspaceLease = {
        runId: input.runId,
        remoteWorkerId: input.remoteWorkerId ?? null,
        remoteWorkerSessionId: input.remoteWorkerSessionId ?? null,
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

  const remoteWorkersStore: RemoteWorkerStore = {
    async upsert(input) {
      for (const candidate of remoteWorkersById.values()) {
        if (candidate.sessionId === input.sessionId && candidate.id !== input.id) {
          throw new Error(
            'duplicate key value violates unique constraint "remote_workers_session_id_key"'
          );
        }
      }

      remoteWorkersById.set(input.id, input);
      return input;
    },
    async getById(id) {
      return remoteWorkersById.get(id) ?? null;
    },
    async getBySession(sessionId) {
      return (
        Array.from(remoteWorkersById.values()).find(
          (worker) => worker.sessionId === sessionId
        ) ?? null
      );
    },
    async listByWorkspace(workspaceId) {
      return Array.from(remoteWorkersById.values())
        .filter((worker) => worker.workspaceId === workspaceId)
        .sort(compareRemoteWorkers);
    },
    async recordHeartbeat(input) {
      const existing = remoteWorkersById.get(input.workerId);

      if (!existing || existing.sessionId !== input.workerSessionId) {
        return null;
      }

      const updated: StoredRemoteWorker = {
        ...existing,
        health: {
          ...existing.health,
          status: input.healthStatus,
          lastHeartbeatAt: input.sentAt
        },
        updatedAt: input.sentAt
      };

      remoteWorkersById.set(updated.id, updated);
      return updated;
    },
    async updateSessionState(input) {
      const existing = remoteWorkersById.get(input.workerId);

      if (!existing || existing.sessionId !== input.workerSessionId) {
        return null;
      }

      const nextHealth = {
        ...existing.health,
        ...(input.healthStatus !== undefined ? { status: input.healthStatus } : {}),
        ...(input.lastHeartbeatAt !== undefined
          ? { lastHeartbeatAt: input.lastHeartbeatAt }
          : {})
      };
      const updated: StoredRemoteWorker = {
        ...existing,
        ...(input.availability !== undefined
          ? { availability: input.availability }
          : {}),
        ...(input.disconnectedAt !== undefined
          ? { disconnectedAt: input.disconnectedAt }
          : {}),
        health: nextHealth,
        updatedAt: input.updatedAt
      };

      remoteWorkersById.set(updated.id, updated);
      return updated;
    },
    async cleanupStaleSessions(input) {
      const updated: StoredRemoteWorker[] = [];

      for (const worker of remoteWorkersById.values()) {
        if (
          worker.availability === "offline" ||
          new Date(worker.health.lastHeartbeatAt).getTime() >=
            new Date(input.staleBefore).getTime()
        ) {
          continue;
        }

        const current = remoteWorkersById.get(worker.id);

        if (
          !current ||
          current.sessionId !== worker.sessionId ||
          current.availability !== worker.availability ||
          current.health.lastHeartbeatAt !== worker.health.lastHeartbeatAt
        ) {
          continue;
        }

        const next: StoredRemoteWorker = {
          ...current,
          availability: "offline",
          health: {
            ...current.health,
            status: "offline"
          },
          disconnectedAt: input.disconnectedAt,
          updatedAt: input.disconnectedAt
        };

        remoteWorkersById.set(next.id, next);
        updated.push(next);
      }

      return updated.sort(compareRemoteWorkers);
    },
    async delete(id) {
      for (const steps of runStepsByRunId.values()) {
        if (steps.some((step) => step.remoteWorkerId === id)) {
          throw foreignKeyDeleteError(
            "remote_workers",
            "run_steps_remote_worker_id_fkey",
            "run_steps"
          );
        }
      }

      for (const lease of workspaceLeasesByRunId.values()) {
        if (lease.remoteWorkerId === id) {
          throw foreignKeyDeleteError(
            "remote_workers",
            "workspace_leases_remote_worker_id_fkey",
            "workspace_leases"
          );
        }
      }

      return remoteWorkersById.delete(id);
    }
  };

  const schedulesStore: ScheduleStore = {
    async create(input) {
      if (schedulesById.has(input.id)) {
        throw new Error('duplicate key value violates unique constraint "schedules_pkey"');
      }

      schedulesById.set(input.id, { ...input });
      return { ...input };
    },
    async getById(id) {
      const schedule = schedulesById.get(id);
      return schedule ? { ...schedule } : null;
    },
    async listByWorkspace(workspaceId) {
      return Array.from(schedulesById.values())
        .filter((schedule) => schedule.workspaceId === workspaceId)
        .sort(compareSchedules)
        .map((schedule) => ({ ...schedule }));
    },
    async listAll() {
      return Array.from(schedulesById.values())
        .sort(compareSchedules)
        .map((schedule) => ({ ...schedule }));
    },
    async update(input) {
      const existing = schedulesById.get(input.id);

      if (!existing) {
        return null;
      }

      const updated: StoredSchedule = {
        ...existing,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.prompt !== undefined ? { prompt: input.prompt } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
        ...(input.outcomeMode !== undefined
          ? { outcomeMode: input.outcomeMode }
          : {}),
        ...(input.dispatchMode !== undefined
          ? { dispatchMode: input.dispatchMode }
          : {}),
        ...(input.nextFireAt !== undefined ? { nextFireAt: input.nextFireAt } : {}),
        ...(input.lastFiredAt !== undefined ? { lastFiredAt: input.lastFiredAt } : {}),
        ...(input.validationDiagnostics !== undefined
          ? { validationDiagnostics: input.validationDiagnostics }
          : {}),
        updatedAt: input.updatedAt
      };

      schedulesById.set(updated.id, updated);
      return { ...updated };
    },
    async recordFire(input) {
      const existing = Array.from(scheduleFiresById.values()).find(
        (fire) =>
          fire.scheduleId === input.scheduleId &&
          fire.occurrenceKey === input.occurrenceKey
      );

      if (existing) {
        return { ...existing };
      }

      const schedule = schedulesById.get(input.scheduleId);

      if (!schedule) {
        throw new Error(`Schedule ${input.scheduleId} does not exist.`);
      }

      const outcome =
        input.outcomeId === null ? null : outcomes.get(input.outcomeId);

      if (input.outcomeId !== null && !outcome) {
        throw new Error(`Outcome ${input.outcomeId} does not exist.`);
      }

      if (outcome && outcome.workspaceId !== schedule.workspaceId) {
        throw new Error(
          `Outcome ${input.outcomeId} belongs to ${outcome.workspaceId}, not ${schedule.workspaceId}.`
        );
      }

      const run = input.runId === null ? null : runsById.get(input.runId);

      if (input.runId !== null && !run) {
        throw new Error(`Run ${input.runId} does not exist.`);
      }

      if (run && input.outcomeId === null) {
        throw new Error(`Schedule fire ${input.id} cannot record run ${input.runId} without an outcome.`);
      }

      if (run && run.outcomeId !== input.outcomeId) {
        throw new Error(
          `Run ${input.runId} belongs to outcome ${run.outcomeId}, not ${input.outcomeId}.`
        );
      }

      const fire: StoredScheduleFire = { ...input };
      scheduleFiresById.set(fire.id, fire);

      if (fire.status === "triggered") {
        schedulesById.set(schedule.id, {
          ...schedule,
          lastFiredAt: fire.firedAt ?? fire.scheduledFor,
          updatedAt: fire.firedAt ?? fire.scheduledFor
        });
      }

      return { ...fire };
    },
    async listFiresBySchedule(scheduleId) {
      return Array.from(scheduleFiresById.values())
        .filter((fire) => fire.scheduleId === scheduleId)
        .sort(compareScheduleFires)
        .map((fire) => ({ ...fire }));
    },
    async delete(id) {
      if (
        Array.from(scheduleFiresById.values()).some(
          (fire) => fire.scheduleId === id
        )
      ) {
        throw foreignKeyDeleteError(
          "schedules",
          "schedule_fires_schedule_id_fkey",
          "schedule_fires"
        );
      }

      return schedulesById.delete(id);
    }
  };

  const messagingStore: MessagingStore = {
    async upsertConnection(input) {
      const existing = Array.from(messagingConnectionsById.values()).find(
        (connection) =>
          connection.workspaceId === input.workspaceId &&
          connection.channel === input.channel
      );

      if (!existing) {
        messagingConnectionsById.set(input.id, { ...input });
        return { ...input };
      }

      const hasBindings = Array.from(conversationBindingsById.values()).some(
        (binding) => binding.connectionId === existing.id
      );

      if (
        existing.externalWorkspaceId !== input.externalWorkspaceId &&
        hasBindings
      ) {
        throw new Error(
          `Messaging connection ${existing.id} cannot switch external workspace from ${existing.externalWorkspaceId} to ${input.externalWorkspaceId} while bindings still reference it.`
        );
      }

      const updated: StoredMessagingConnection = {
        ...existing,
        transport: input.transport,
        status: input.status,
        enabled: input.enabled,
        accountLabel: input.accountLabel,
        externalWorkspaceId: input.externalWorkspaceId,
        externalWorkspaceLabel: input.externalWorkspaceLabel,
        connectedAt: input.connectedAt,
        lastInboundAt: input.lastInboundAt,
        lastOutboundAt: input.lastOutboundAt,
        lastError: input.lastError,
        updatedAt: input.updatedAt
      };

      messagingConnectionsById.set(existing.id, updated);
      return { ...updated };
    },
    async getConnectionById(id) {
      const connection = messagingConnectionsById.get(id);
      return connection ? { ...connection } : null;
    },
    async listConnectionsByWorkspace(workspaceId) {
      return Array.from(messagingConnectionsById.values())
        .filter((connection) => connection.workspaceId === workspaceId)
        .sort(compareMessagingConnections)
        .map((connection) => ({ ...connection }));
    },
    async bindConversation(input) {
      const connection = messagingConnectionsById.get(input.connectionId);

      if (!connection) {
        throw new Error(`Messaging connection ${input.connectionId} does not exist.`);
      }

      if (
        connection.workspaceId !== input.workspaceId ||
        connection.channel !== input.channel
      ) {
        throw new Error(
          `Messaging connection ${input.connectionId} does not belong to ${input.workspaceId}/${input.channel}.`
        );
      }

      if (connection.externalWorkspaceId !== input.externalWorkspaceId) {
        throw new Error(
          `Messaging connection ${input.connectionId} is authenticated to external workspace ${connection.externalWorkspaceId}, not ${input.externalWorkspaceId}.`
        );
      }

      const outcome = outcomes.get(input.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${input.outcomeId} does not exist.`);
      }

      if (outcome.workspaceId !== input.workspaceId) {
        throw new Error(
          `Outcome ${input.outcomeId} belongs to ${outcome.workspaceId}, not ${input.workspaceId}.`
        );
      }

      const existing = Array.from(conversationBindingsById.values()).find(
        (binding) =>
          binding.workspaceId === input.workspaceId &&
          binding.channel === input.channel &&
          binding.externalWorkspaceId === input.externalWorkspaceId &&
          binding.conversationId === input.conversationId &&
          (binding.threadId ?? null) === input.threadId
      );

      if (existing && existing.outcomeId !== input.outcomeId) {
        throw new Error(
          `Conversation ${messagingConversationKey(input)} is already bound to outcome ${existing.outcomeId}.`
        );
      }

      if (existing) {
        const updated: StoredExternalConversationBinding = {
          ...existing,
          connectionId: input.connectionId,
          lastInboundMessageId: input.lastInboundMessageId,
          lastOutboundDeliveryId: input.lastOutboundDeliveryId,
          updatedAt: input.updatedAt
        };

        conversationBindingsById.set(updated.id, updated);
        return { ...updated };
      }

      conversationBindingsById.set(input.id, { ...input });
      return { ...input };
    },
    async getBindingByExternalConversation(input) {
      const found = Array.from(conversationBindingsById.values()).find(
        (binding) =>
          binding.workspaceId === input.workspaceId &&
          binding.channel === input.channel &&
          binding.externalWorkspaceId === input.externalWorkspaceId &&
          binding.conversationId === input.conversationId &&
          (binding.threadId ?? null) === input.threadId
      );

      return found ? { ...found } : null;
    }
  };

  const approvalsStore: ApprovalStore = {
    async createPending(input) {
      if (approvalsById.has(input.id)) {
        throw new Error('duplicate key value violates unique constraint "approvals_pkey"');
      }

      const outcome = outcomes.get(input.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${input.outcomeId} does not exist.`);
      }

      if (outcome.workspaceId !== input.workspaceId) {
        throw new Error(
          `Outcome ${input.outcomeId} belongs to ${outcome.workspaceId}, not ${input.workspaceId}.`
        );
      }

      const run = runsById.get(input.runId);

      if (!run) {
        throw new Error(`Run ${input.runId} does not exist.`);
      }

      if (run.outcomeId !== input.outcomeId) {
        throw new Error(
          `Run ${input.runId} belongs to ${run.outcomeId}, not ${input.outcomeId}.`
        );
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

      for (const artifactId of input.artifactIds) {
        const artifact = artifacts.get(artifactId);

        if (!artifact) {
          throw new Error(`Artifact ${artifactId} does not exist.`);
        }

        if (
          artifact.outcomeId !== input.outcomeId ||
          artifact.runId !== input.runId ||
          artifact.stepId !== input.stepId
        ) {
          throw new Error(
            `Artifact ${artifactId} does not belong to approval step ${input.stepId} in run ${input.runId}.`
          );
        }
      }

      const approval: StoredApproval = {
        id: input.id,
        workspaceId: input.workspaceId,
        outcomeId: input.outcomeId,
        runId: input.runId,
        stepId: input.stepId,
        status: "pending",
        kind: input.kind,
        title: input.title,
        summary: input.summary,
        instruction: input.instruction,
        artifactIds: [...input.artifactIds],
        requestedAt: input.requestedAt,
        resolvedAt: null,
        resolution: null,
        resolutionNote: null
      };

      approvalsById.set(approval.id, approval);
      return approval;
    },
    async getById(id) {
      return approvalsById.get(id) ?? null;
    },
    async listByWorkspace(input) {
      return Array.from(approvalsById.values())
        .filter(
          (approval) =>
            approval.workspaceId === input.workspaceId &&
            (input.status ? approval.status === input.status : true)
        )
        .sort(compareApprovals);
    },
    async cancel(input) {
      const existing = approvalsById.get(input.approvalId);

      if (!existing || existing.status !== "pending") {
        return null;
      }

      const cancelled: StoredApproval = {
        ...existing,
        status: "cancelled",
        resolution: "cancelled",
        resolutionNote: input.resolutionNote,
        resolvedAt: input.resolvedAt
      };

      approvalsById.set(cancelled.id, cancelled);
      return cancelled;
    },
    async resolve(input) {
      const existing = approvalsById.get(input.approvalId);

      if (!existing) {
        return null;
      }

      if (existing.status !== "pending") {
        throw new Error(`Approval ${input.approvalId} is already resolved.`);
      }

      const run = runsById.get(existing.runId);

      if (!run) {
        throw new Error(`Run ${existing.runId} does not exist.`);
      }

      if (run.outcomeId !== existing.outcomeId) {
        throw new Error(
          `Run ${existing.runId} belongs to ${run.outcomeId}, not ${existing.outcomeId}.`
        );
      }

      const located = getStoredRunStep(state, existing.stepId);

      if (!located) {
        throw new Error(`Step ${existing.stepId} does not exist.`);
      }

      if (located.runId !== existing.runId) {
        throw new Error(
          `Step ${existing.stepId} belongs to ${located.runId}, not ${existing.runId}.`
        );
      }

      const outcome = outcomes.get(existing.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${existing.outcomeId} does not exist.`);
      }

      if (outcome.workspaceId !== existing.workspaceId) {
        throw new Error(
          `Outcome ${existing.outcomeId} belongs to ${outcome.workspaceId}, not ${existing.workspaceId}.`
        );
      }

      const updatedApproval: StoredApproval = {
        ...existing,
        status: input.resolution === "cancelled" ? "cancelled" : "resolved",
        resolvedAt: input.resolvedAt,
        resolution: input.resolution,
        resolutionNote: input.resolutionNote
      };
      const updatedStep: StoredRunStep = {
        ...located.step,
        status: input.stepStatus,
        updatedAt: input.updatedAt
      };
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

      approvalsById.set(updatedApproval.id, updatedApproval);
      runsById.set(updatedRun.id, updatedRun);
      outcomes.set(updatedOutcome.id, updatedOutcome);
      runStepsByRunId.set(
        located.runId,
        (runStepsByRunId.get(located.runId) ?? []).map((candidate) =>
          candidate.id === updatedStep.id ? updatedStep : candidate
        )
      );

      return {
        approval: updatedApproval,
        step: updatedStep,
        run: updatedRun,
        outcome: updatedOutcome
      };
    }
  };

  const artifactLineageStore: ArtifactLineageStore = {
    async createMany(inputs) {
      const edges: StoredArtifactLineageEdge[] = [];

      for (const input of inputs) {
        const run = runsById.get(input.runId);

        if (!run) {
          throw new Error(`Run ${input.runId} does not exist.`);
        }

        const parentArtifact = artifacts.get(input.parentArtifactId);
        const childArtifact = artifacts.get(input.childArtifactId);

        if (!parentArtifact) {
          throw new Error(`Artifact ${input.parentArtifactId} does not exist.`);
        }

        if (!childArtifact) {
          throw new Error(`Artifact ${input.childArtifactId} does not exist.`);
        }

        const parentStep = getStoredRunStep(state, input.parentStepId);
        const childStep = getStoredRunStep(state, input.childStepId);

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
          throw new Error(`Artifact-lineage edges must stay within run ${input.runId}.`);
        }

        if (
          parentArtifact.stepId !== input.parentStepId ||
          childArtifact.stepId !== input.childStepId
        ) {
          throw new Error(
            "Artifact-lineage edges must match their parent and child step context."
          );
        }

        const edge: StoredArtifactLineageEdge = {
          id: input.id,
          runId: input.runId,
          parentArtifactId: input.parentArtifactId,
          childArtifactId: input.childArtifactId,
          parentStepId: input.parentStepId,
          childStepId: input.childStepId,
          relation: input.relation,
          createdAt: input.createdAt
        };

        artifactLineageEdgesById.set(edge.id, edge);
        edges.push(edge);
      }

      return edges.sort(compareArtifactLineageEdges);
    },
    async listByRun(runId) {
      return Array.from(artifactLineageEdgesById.values())
        .filter((edge) => edge.runId === runId)
        .sort(compareArtifactLineageEdges);
    },
    async listByArtifact(artifactId) {
      return Array.from(artifactLineageEdgesById.values())
        .filter(
          (edge) =>
            edge.parentArtifactId === artifactId || edge.childArtifactId === artifactId
        )
        .sort(compareArtifactLineageEdges);
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
    async getStoredById(id) {
      return workspaceCredentialsById.get(id) ?? null;
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
    checkpointsStore,
    auditEventsStore,
    approvalsStore,
    artifactLineageStore,
    workspaceLeasesStore,
    remoteWorkersStore,
    schedulesStore,
    messagingStore,
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
    checkpoints: state.checkpointsStore,
    auditEvents: state.auditEventsStore,
    approvals: state.approvalsStore,
    artifactLineage: state.artifactLineageStore,
    workspaceLeases: state.workspaceLeasesStore,
    remoteWorkers: state.remoteWorkersStore,
    schedules: state.schedulesStore,
    messaging: state.messagingStore,
    workspaceCredentials: state.workspaceCredentialsStore,
    authProfiles: state.authProfilesStore,
    routerPolicy: state.routerPolicyStore
  };
}

export async function createDatabaseRepositories(
  connectionString: string
): Promise<Repositories> {
  const {
    ApprovalRepository,
    AuditEventRepository,
    AuthProfileRepository,
    ArtifactRepository,
    ArtifactLineageRepository,
    CheckpointRepository,
    OutcomeRepository,
    PlanRepository,
    RouterPolicyRepository,
    RemoteWorkerRepository,
    RunRepository,
    MessagingRepository,
    ScheduleRepository,
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
    checkpoints: new CheckpointRepository(db),
    auditEvents: new AuditEventRepository(db),
    approvals: new ApprovalRepository(db),
    artifactLineage: new ArtifactLineageRepository(db),
    workspaceLeases: new WorkspaceLeaseRepository(db),
    remoteWorkers: new RemoteWorkerRepository(db),
    schedules: new ScheduleRepository(db),
    messaging: new MessagingRepository(db),
    workspaceCredentials: new WorkspaceCredentialRepository(db),
    authProfiles: new AuthProfileRepository(db),
    routerPolicy: new RouterPolicyRepository(db)
  };
}
