"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import type {
  Approval,
  Artifact,
  ArtifactLineageEdge,
  AuditEvent,
  ExternalConversationBinding,
  MessagingConnection,
  MessagingDelivery,
  RemoteStepLifecycleEventData,
  RemoteWorker,
  CheckpointDetail,
  CheckpointSummary,
  AuthProfile,
  RunDetail,
  RunLogData
} from "@computer-oss/protocol";
import {
  AuditListResponseSchema,
  CheckpointDetailSchema,
  ResumeRunResponseSchema
} from "@computer-oss/protocol";
import { subscribeToOutcomeEvents } from "../../lib/events";
import { AuditTrail } from "./audit-trail";
import { ArtifactLineagePanel } from "./artifact-lineage-panel";
import { ArtifactList } from "./artifact-list";
import { Badge } from "../ui/badge";
import { CheckpointDetailCard } from "./checkpoint-detail-card";
import { CheckpointTimeline } from "./checkpoint-timeline";
import { RemoteWorkerPanel } from "./remote-worker-panel";
import { RunLogPanel } from "./run-log-panel";
import { RunTimeline } from "./run-timeline";

type ExecutionConsoleProps = {
  outcomeId: string;
  outcomeSource: "web" | "schedule" | "slack" | "telegram";
  initialRun: RunDetail | null;
  initialArtifacts: Artifact[];
  initialLogs: RunLogData[];
  initialPendingApprovals?: Approval[];
  initialLineageEdges?: ArtifactLineageEdge[];
  initialAuthProfiles?: AuthProfile[];
  initialWorkers?: RemoteWorker[];
  initialCheckpoints?: CheckpointSummary[];
  initialSelectedCheckpoint?: CheckpointDetail | null;
  initialAuditEvents?: AuditEvent[];
  initialMessageHistory?: {
    connection: MessagingConnection | null;
    bindings: ExternalConversationBinding[];
    deliveries: MessagingDelivery[];
  } | null;
};

type ExecutionConsoleState = {
  selectedRunId: string | null;
  currentRun: RunDetail | null;
  artifacts: Artifact[];
  logs: RunLogData[];
  pendingApprovals: Approval[];
  workers: RemoteWorker[];
  messageHistory: {
    connection: MessagingConnection | null;
    bindings: ExternalConversationBinding[];
    deliveries: MessagingDelivery[];
  } | null;
  remoteStepStates: Record<string, RemoteStepLifecycleEventData>;
  checkpoints: CheckpointSummary[];
  selectedCheckpointId: string | null;
  checkpointDetailsById: Record<string, CheckpointDetail>;
  auditEvents: AuditEvent[];
  isResuming: boolean;
  resumeStatusMessage: {
    tone: "default" | "error";
    text: string;
  } | null;
};

const EMPTY_APPROVALS: Approval[] = [];
const EMPTY_LINEAGE_EDGES: ArtifactLineageEdge[] = [];
const EMPTY_AUTH_PROFILES: AuthProfile[] = [];
const EMPTY_WORKERS: RemoteWorker[] = [];
const EMPTY_CHECKPOINTS: CheckpointSummary[] = [];
const EMPTY_AUDIT_EVENTS: AuditEvent[] = [];
const EMPTY_MESSAGE_HISTORY = null;

function sortArtifacts(artifacts: Artifact[]) {
  return [...artifacts].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function upsertArtifact(artifacts: Artifact[], incoming: Artifact) {
  const next = artifacts.some((artifact) => artifact.id === incoming.id)
    ? artifacts.map((artifact) =>
        artifact.id === incoming.id ? incoming : artifact
      )
    : [incoming, ...artifacts];

  return sortArtifacts(next);
}

function sortLogs(logs: RunLogData[]) {
  return [...logs].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function logKey(log: RunLogData) {
  return [
    log.runId,
    log.stepId ?? "run",
    log.createdAt,
    log.level,
    log.message
  ].join(":");
}

function appendLog(logs: RunLogData[], incoming: RunLogData) {
  if (logs.some((log) => logKey(log) === logKey(incoming))) {
    return sortLogs(logs);
  }

  return sortLogs([incoming, ...logs]).slice(0, 40);
}

function sortCheckpoints(checkpoints: CheckpointSummary[]) {
  return [...checkpoints].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return right.sequence - left.sequence;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function upsertCheckpoint(
  checkpoints: CheckpointSummary[],
  incoming: CheckpointSummary
) {
  const next = checkpoints.some((checkpoint) => checkpoint.id === incoming.id)
    ? checkpoints.map((checkpoint) =>
        checkpoint.id === incoming.id ? incoming : checkpoint
      )
    : [incoming, ...checkpoints];

  return sortCheckpoints(next);
}

function sortAuditEvents(events: AuditEvent[]) {
  return [...events].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

function sortWorkers(workers: RemoteWorker[]) {
  return [...workers].sort((left, right) => {
    const updatedDelta = right.updatedAt.localeCompare(left.updatedAt);

    if (updatedDelta !== 0) {
      return updatedDelta;
    }

    return left.label.localeCompare(right.label);
  });
}

function shouldReplaceWorker(current: RemoteWorker, incoming: RemoteWorker) {
  const updatedDelta = incoming.updatedAt.localeCompare(current.updatedAt);

  if (updatedDelta !== 0) {
    return updatedDelta > 0;
  }

  const heartbeatDelta = incoming.health.lastHeartbeatAt.localeCompare(
    current.health.lastHeartbeatAt
  );

  if (heartbeatDelta !== 0) {
    return heartbeatDelta > 0;
  }

  return incoming.connectedAt.localeCompare(current.connectedAt) >= 0;
}

function upsertWorker(workers: RemoteWorker[], incoming: RemoteWorker) {
  const existing = workers.find((worker) => worker.id === incoming.id);

  if (!existing) {
    return sortWorkers([incoming, ...workers]);
  }

  if (!shouldReplaceWorker(existing, incoming)) {
    return sortWorkers(workers);
  }

  return sortWorkers(
    workers.map((worker) => (worker.id === incoming.id ? incoming : worker))
  );
}

function shouldReplaceRemoteStepState(
  current: RemoteStepLifecycleEventData,
  incoming: RemoteStepLifecycleEventData
) {
  const occurredDelta = incoming.occurredAt.localeCompare(current.occurredAt);

  if (occurredDelta !== 0) {
    return occurredDelta > 0;
  }

  return incoming.assignment.assignedAt.localeCompare(current.assignment.assignedAt) >= 0;
}

function upsertRemoteStepState(
  current: Record<string, RemoteStepLifecycleEventData>,
  incoming: RemoteStepLifecycleEventData
) {
  const existing = current[incoming.stepId];

  if (existing && !shouldReplaceRemoteStepState(existing, incoming)) {
    return current;
  }

  return {
    ...current,
    [incoming.stepId]: incoming
  };
}

function buildInitialState(
  initialRun: RunDetail | null,
  initialArtifacts: Artifact[],
  initialLogs: RunLogData[],
  initialPendingApprovals: Approval[],
  initialWorkers: RemoteWorker[],
  initialCheckpoints: CheckpointSummary[],
  initialSelectedCheckpoint: CheckpointDetail | null,
  initialAuditEvents: AuditEvent[],
  initialMessageHistory: {
    connection: MessagingConnection | null;
    bindings: ExternalConversationBinding[];
    deliveries: MessagingDelivery[];
  } | null
): ExecutionConsoleState {
  const orderedCheckpoints = sortCheckpoints(initialCheckpoints);
  const selectedCheckpointId =
    initialSelectedCheckpoint?.id ??
    initialRun?.latestCheckpointId ??
    orderedCheckpoints[0]?.id ??
    null;

  return {
    selectedRunId: initialRun?.id ?? null,
    currentRun: initialRun,
    artifacts: sortArtifacts(initialArtifacts),
    logs: sortLogs(initialLogs),
    pendingApprovals: initialPendingApprovals,
    workers: sortWorkers(initialWorkers),
    messageHistory: initialMessageHistory,
    remoteStepStates: {},
    checkpoints: orderedCheckpoints,
    selectedCheckpointId,
    checkpointDetailsById: initialSelectedCheckpoint
      ? {
          [initialSelectedCheckpoint.id]: initialSelectedCheckpoint
        }
      : {},
    auditEvents: sortAuditEvents(initialAuditEvents),
    isResuming: false,
    resumeStatusMessage: null
  };
}

function readErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

export function ExecutionConsole({
  outcomeId,
  outcomeSource,
  initialRun,
  initialArtifacts,
  initialLogs,
  initialPendingApprovals = EMPTY_APPROVALS,
  initialLineageEdges = EMPTY_LINEAGE_EDGES,
  initialAuthProfiles = EMPTY_AUTH_PROFILES,
  initialWorkers = EMPTY_WORKERS,
  initialCheckpoints = EMPTY_CHECKPOINTS,
  initialSelectedCheckpoint = null,
  initialAuditEvents = EMPTY_AUDIT_EVENTS,
  initialMessageHistory = EMPTY_MESSAGE_HISTORY
}: ExecutionConsoleProps) {
  const [state, setState] = useState<ExecutionConsoleState>(() =>
    buildInitialState(
      initialRun,
      initialArtifacts,
      initialLogs,
      initialPendingApprovals,
      initialWorkers,
      initialCheckpoints,
      initialSelectedCheckpoint,
      initialAuditEvents,
      initialMessageHistory
    )
  );
  const currentPendingApproval =
    state.pendingApprovals.find((approval) => approval.runId === state.selectedRunId) ??
    null;
  const selectedCheckpoint =
    (state.selectedCheckpointId
      ? state.checkpointDetailsById[state.selectedCheckpointId]
      : null) ?? null;
  const pendingCheckpointLoadsRef = useRef(new Set<string>());
  const failedCheckpointLoadsRef = useRef(new Set<string>());
  const auditRefreshRequestRef = useRef(0);

  async function loadCheckpointDetail(checkpointId: string) {
    const response = await fetch(`/api/checkpoints/${checkpointId}`, {
      cache: "no-store"
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(readErrorMessage(payload, "Unable to load checkpoint detail."));
    }

    return CheckpointDetailSchema.parse(payload);
  }

  async function refreshAuditTrail(runId: string) {
    const response = await fetch(`/api/runs/${runId}/audit`, {
      cache: "no-store"
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(readErrorMessage(payload, "Unable to load audit history."));
    }

    return AuditListResponseSchema.parse(payload).events;
  }

  async function refreshAuditTrailIntoState(
    runId: string,
    errorMessage: string
  ) {
    const requestId = auditRefreshRequestRef.current + 1;
    auditRefreshRequestRef.current = requestId;

    try {
      const events = await refreshAuditTrail(runId);

      setState((current) => {
        if (
          requestId !== auditRefreshRequestRef.current ||
          current.selectedRunId !== runId
        ) {
          return current;
        }

        return {
          ...current,
          auditEvents: sortAuditEvents(events)
        };
      });
    } catch {
      setState((current) => {
        if (
          requestId !== auditRefreshRequestRef.current ||
          current.selectedRunId !== runId
        ) {
          return current;
        }

        return {
          ...current,
          resumeStatusMessage: {
            tone: "error",
            text: errorMessage
          }
        };
      });
    }
  }

  async function ensureCheckpointDetail(
    checkpointId: string,
    errorMessage: string
  ) {
    if (
      pendingCheckpointLoadsRef.current.has(checkpointId) ||
      failedCheckpointLoadsRef.current.has(checkpointId)
    ) {
      return;
    }

    pendingCheckpointLoadsRef.current.add(checkpointId);

    try {
      const detail = await loadCheckpointDetail(checkpointId);
      failedCheckpointLoadsRef.current.delete(checkpointId);

      setState((current) => ({
        ...current,
        checkpointDetailsById: {
          ...current.checkpointDetailsById,
          [detail.id]: detail
        }
      }));
    } catch {
      failedCheckpointLoadsRef.current.add(checkpointId);

      setState((current) => ({
        ...current,
        resumeStatusMessage: {
          tone: "error",
          text: errorMessage
        }
      }));
    } finally {
      pendingCheckpointLoadsRef.current.delete(checkpointId);
    }
  }

  async function resumeSelectedRun(checkpointId: string) {
    if (!state.selectedRunId) {
      return;
    }

    setState((current) => ({
      ...current,
      isResuming: true,
      resumeStatusMessage: null
    }));

    try {
      const response = await fetch(`/api/runs/${state.selectedRunId}/resume`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          checkpointId
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          readErrorMessage(payload, "Unable to resume interrupted run.")
        );
      }

      const resumed = ResumeRunResponseSchema.parse(payload);
      setState((current) => ({
        ...current,
        currentRun:
          current.currentRun && current.currentRun.id === resumed.run.id
            ? {
                ...current.currentRun,
                ...resumed.run
              }
            : current.currentRun,
        selectedCheckpointId: resumed.resumedFromCheckpointId,
        isResuming: false,
        resumeStatusMessage: {
          tone: "default",
          text: `Resume requested from checkpoint ${resumed.resumedFromCheckpointId}.`
        }
      }));

      void refreshAuditTrailIntoState(
        resumed.run.id,
        "Unable to load audit history after resume."
      );
    } catch (error) {
      setState((current) => ({
        ...current,
        isResuming: false,
        resumeStatusMessage: {
          tone: "error",
          text:
            error instanceof Error
              ? error.message
              : "Unable to resume interrupted run."
        }
      }));
    }
  }

  useEffect(() => {
    setState(
      buildInitialState(
        initialRun,
        initialArtifacts,
        initialLogs,
        initialPendingApprovals,
        initialWorkers,
        initialCheckpoints,
        initialSelectedCheckpoint,
        initialAuditEvents,
        initialMessageHistory
      )
    );
  }, [
    initialRun,
    initialArtifacts,
    initialLogs,
    initialPendingApprovals,
    initialWorkers,
    initialCheckpoints,
    initialSelectedCheckpoint,
    initialAuditEvents,
    initialMessageHistory
  ]);

  useEffect(() => {
    if (!state.selectedCheckpointId) {
      return;
    }

    if (state.checkpointDetailsById[state.selectedCheckpointId]) {
      return;
    }

    void ensureCheckpointDetail(
      state.selectedCheckpointId,
      "Unable to load selected checkpoint detail."
    );
  }, [state.selectedCheckpointId, state.checkpointDetailsById]);

  useEffect(() => {
    return subscribeToOutcomeEvents(outcomeId, (event) => {
      startTransition(() => {
        if (event.type === "run.updated") {
          setState((current) => {
            if (
              !current.currentRun ||
              current.selectedRunId !== event.data.id ||
              current.currentRun.id !== event.data.id
            ) {
              return current;
            }

            return {
              ...current,
              currentRun: {
                ...current.currentRun,
                ...event.data
              }
            };
          });

          return;
        }

        setState((current) => {
          if (event.type === "run.created") {
            if (current.selectedRunId && current.selectedRunId !== event.data.id) {
              return current;
            }

            return {
              ...current,
              selectedRunId: event.data.id,
              currentRun:
                current.currentRun && current.currentRun.id === event.data.id
                  ? {
                      ...current.currentRun,
                      ...event.data
                    }
                  : {
                      ...event.data,
                      steps: []
                    },
              artifacts:
                current.selectedRunId === event.data.id ? current.artifacts : [],
              logs: current.selectedRunId === event.data.id ? current.logs : [],
              pendingApprovals: current.pendingApprovals,
              workers: current.workers,
              remoteStepStates:
                current.selectedRunId === event.data.id ? current.remoteStepStates : {},
              checkpoints: current.selectedRunId === event.data.id ? current.checkpoints : [],
              selectedCheckpointId:
                current.selectedRunId === event.data.id
                  ? current.selectedCheckpointId
                  : null,
              checkpointDetailsById:
                current.selectedRunId === event.data.id
                  ? current.checkpointDetailsById
                  : {},
              auditEvents:
                current.selectedRunId === event.data.id ? current.auditEvents : [],
              resumeStatusMessage: null
            };
          }

          if (event.type === "artifact.created") {
            if (!current.selectedRunId || event.data.runId !== current.selectedRunId) {
              return current;
            }

            return {
              ...current,
              artifacts: upsertArtifact(current.artifacts, event.data)
            };
          }

          if (event.type === "run.log") {
            if (!current.selectedRunId || event.data.runId !== current.selectedRunId) {
              return current;
            }

            return {
              ...current,
              logs: appendLog(current.logs, event.data)
            };
          }

          if (event.type === "checkpoint.created") {
            if (!current.selectedRunId || event.data.runId !== current.selectedRunId) {
              return current;
            }

            failedCheckpointLoadsRef.current.delete(event.data.id);
            void ensureCheckpointDetail(
              event.data.id,
              "Unable to load the latest checkpoint detail."
            );

            void refreshAuditTrailIntoState(
              event.data.runId,
              "Unable to refresh audit history after checkpoint capture."
            );

            return {
              ...current,
              currentRun:
                current.currentRun && current.currentRun.id === event.data.runId
                  ? {
                      ...current.currentRun,
                      latestCheckpointId: event.data.id,
                      resumable: event.data.resumable
                    }
                  : current.currentRun,
              checkpoints: upsertCheckpoint(current.checkpoints, event.data),
              selectedCheckpointId: event.data.id
            };
          }

          if (event.type === "approval.requested") {
            const nextPendingApprovals = current.pendingApprovals.some(
              (approval) => approval.id === event.data.id
            )
              ? current.pendingApprovals.map((approval) =>
                  approval.id === event.data.id ? event.data : approval
                )
              : [event.data, ...current.pendingApprovals];

            return {
              ...current,
              pendingApprovals: nextPendingApprovals
            };
          }

          if (event.type === "approval.resolved") {
            return {
              ...current,
              pendingApprovals: current.pendingApprovals.filter(
                (approval) => approval.id !== event.data.id
              )
            };
          }

          if (
            event.type === "worker.connected" ||
            event.type === "worker.disconnected"
          ) {
            return {
              ...current,
              workers: upsertWorker(current.workers, event.data)
            };
          }

          if (event.type === "remote.step.updated") {
            if (!current.selectedRunId || event.data.runId !== current.selectedRunId) {
              return current;
            }

            return {
              ...current,
              remoteStepStates: upsertRemoteStepState(
                current.remoteStepStates,
                event.data
              )
            };
          }

          if (event.type === "run.interrupted") {
            if (
              !current.currentRun ||
              current.selectedRunId !== event.data.run.id ||
              current.currentRun.id !== event.data.run.id
            ) {
              return current;
            }

            void refreshAuditTrailIntoState(
              event.data.run.id,
              "Unable to refresh audit history after interruption."
            );

            return {
              ...current,
              currentRun: {
                ...current.currentRun,
                ...event.data.run
              },
              selectedCheckpointId: event.data.interruptedFromCheckpointId,
              resumeStatusMessage: {
                tone: "default",
                text: `Run interrupted from checkpoint ${event.data.interruptedFromCheckpointId}.`
              }
            };
          }

          if (event.type === "run.resumed") {
            if (
              !current.currentRun ||
              current.selectedRunId !== event.data.run.id ||
              current.currentRun.id !== event.data.run.id
            ) {
              return current;
            }

            void refreshAuditTrailIntoState(
              event.data.run.id,
              "Unable to refresh audit history after resume."
            );

            if (!current.checkpointDetailsById[event.data.resumedFromCheckpointId]) {
              failedCheckpointLoadsRef.current.delete(
                event.data.resumedFromCheckpointId
              );
              void ensureCheckpointDetail(
                event.data.resumedFromCheckpointId,
                "Unable to load resumed checkpoint detail."
              );
            }

            return {
              ...current,
              currentRun: {
                ...current.currentRun,
                ...event.data.run
              },
              selectedCheckpointId: event.data.resumedFromCheckpointId,
              isResuming: false,
              resumeStatusMessage: {
                tone: "default",
                text: `Run resumed from checkpoint ${event.data.resumedFromCheckpointId}.`
              }
            };
          }

          if (event.type === "messaging.connection.updated") {
            return {
              ...current,
              messageHistory: current.messageHistory
                ? {
                    ...current.messageHistory,
                    connection: event.data
                  }
                : {
                    connection: event.data,
                    bindings: [],
                    deliveries: []
                  }
            };
          }

          if (event.type === "messaging.delivery.updated") {
            const deliveries = current.messageHistory?.deliveries ?? [];
            const nextDeliveries = deliveries.some(
              (delivery) => delivery.id === event.data.id
            )
              ? deliveries.map((delivery) =>
                  delivery.id === event.data.id ? event.data : delivery
                )
              : [event.data, ...deliveries];

            return {
              ...current,
              messageHistory: {
                connection: current.messageHistory?.connection ?? null,
                bindings: current.messageHistory?.bindings ?? [],
                deliveries: nextDeliveries
              }
            };
          }

          return current;
        });
      });
    });
  }, [outcomeId]);

  const primaryBinding = state.messageHistory?.bindings[0] ?? null;
  const sentDeliveryCount =
    state.messageHistory?.deliveries.filter((delivery) => delivery.status === "sent")
      .length ?? 0;

  return (
    <>
      {outcomeSource !== "web" ? (
        <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
                Ingress
              </p>
              <h2 className="font-serif text-xl tracking-tight text-ink">
                {outcomeSource === "schedule"
                  ? "Scheduled trigger"
                  : `Inbound from ${outcomeSource}`}
              </h2>
              <p className="text-sm leading-6 text-muted">
                {outcomeSource === "schedule"
                  ? "This outcome entered Mycelium from a durable schedule and then reused the normal execution path."
                  : "This outcome entered Mycelium from a bound messaging conversation and keeps its channel state visible here."}
              </p>
            </div>
            <Badge variant="sky">{outcomeSource}</Badge>
          </div>

          {state.messageHistory ? (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-panel-line bg-surface-elevated p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  Connection
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {state.messageHistory.connection?.accountLabel ?? "Unknown connection"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {state.messageHistory.connection?.status ?? "untracked"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-panel-line bg-surface-elevated p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  Conversation
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {primaryBinding?.conversationId ?? "No conversation binding"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {primaryBinding?.threadId
                    ? `Thread ${primaryBinding.threadId}`
                    : "No thread id"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-panel-line bg-surface-elevated p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  Deliveries
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {sentDeliveryCount} sent delivery{sentDeliveryCount === 1 ? "" : "ies"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {state.messageHistory.deliveries.length} total delivery records
                </p>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      <RunTimeline
        outcomeId={outcomeId}
        initialRun={state.currentRun}
        selectedRunId={state.selectedRunId}
        authProfiles={initialAuthProfiles}
        remoteStepStates={state.remoteStepStates}
      />
      <RemoteWorkerPanel
        run={state.currentRun}
        workers={state.workers}
        remoteStepStates={state.remoteStepStates}
        statusMessage={state.resumeStatusMessage}
      />
      {currentPendingApproval ? (
        <section className="rounded-[2rem] border border-amber-200/80 bg-amber-50/90 p-6 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">
                Blocked on review
              </p>
              <h2 className="font-serif text-xl tracking-tight text-amber-950">
                {currentPendingApproval.title}
              </h2>
              <p className="text-sm leading-6 text-amber-900">
                {currentPendingApproval.instruction ??
                  "Approve to continue or reject to fail the blocked run."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="amber">pending</Badge>
              <Badge variant="slate">{currentPendingApproval.artifactIds.length} artifacts</Badge>
            </div>
          </div>
        </section>
      ) : null}
      <CheckpointTimeline
        selectedRunId={state.selectedRunId}
        checkpoints={state.checkpoints}
        selectedCheckpointId={state.selectedCheckpointId}
        onSelectCheckpoint={(checkpointId) =>
          {
            failedCheckpointLoadsRef.current.delete(checkpointId);

            if (
              state.selectedCheckpointId === checkpointId &&
              !state.checkpointDetailsById[checkpointId]
            ) {
              void ensureCheckpointDetail(
                checkpointId,
                "Unable to load selected checkpoint detail."
              );
            }

            setState((current) => ({
              ...current,
              selectedCheckpointId: checkpointId,
              resumeStatusMessage: null
            }));
          }
        }
      />
      <CheckpointDetailCard
        run={state.currentRun}
        checkpoint={selectedCheckpoint}
        onResume={resumeSelectedRun}
        isResuming={state.isResuming}
        statusMessage={state.resumeStatusMessage}
      />
      <ArtifactLineagePanel
        selectedRunId={state.selectedRunId}
        artifacts={state.artifacts}
        edges={initialLineageEdges}
      />
      <AuditTrail selectedRunId={state.selectedRunId} events={state.auditEvents} />
      <ArtifactList
        selectedRunId={state.selectedRunId}
        artifacts={state.artifacts}
      />
      <RunLogPanel selectedRunId={state.selectedRunId} logs={state.logs} />
    </>
  );
}
