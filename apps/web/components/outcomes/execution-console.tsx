"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import type {
  Approval,
  Artifact,
  ArtifactLineageEdge,
  AuditEvent,
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
import { RunLogPanel } from "./run-log-panel";
import { RunTimeline } from "./run-timeline";

type ExecutionConsoleProps = {
  outcomeId: string;
  initialRun: RunDetail | null;
  initialArtifacts: Artifact[];
  initialLogs: RunLogData[];
  initialPendingApprovals?: Approval[];
  initialLineageEdges?: ArtifactLineageEdge[];
  initialAuthProfiles?: AuthProfile[];
  initialCheckpoints?: CheckpointSummary[];
  initialSelectedCheckpoint?: CheckpointDetail | null;
  initialAuditEvents?: AuditEvent[];
};

type ExecutionConsoleState = {
  selectedRunId: string | null;
  currentRun: RunDetail | null;
  artifacts: Artifact[];
  logs: RunLogData[];
  pendingApprovals: Approval[];
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
const EMPTY_CHECKPOINTS: CheckpointSummary[] = [];
const EMPTY_AUDIT_EVENTS: AuditEvent[] = [];

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

function buildInitialState(
  initialRun: RunDetail | null,
  initialArtifacts: Artifact[],
  initialLogs: RunLogData[],
  initialPendingApprovals: Approval[],
  initialCheckpoints: CheckpointSummary[],
  initialSelectedCheckpoint: CheckpointDetail | null,
  initialAuditEvents: AuditEvent[]
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
  initialRun,
  initialArtifacts,
  initialLogs,
  initialPendingApprovals = EMPTY_APPROVALS,
  initialLineageEdges = EMPTY_LINEAGE_EDGES,
  initialAuthProfiles = EMPTY_AUTH_PROFILES,
  initialCheckpoints = EMPTY_CHECKPOINTS,
  initialSelectedCheckpoint = null,
  initialAuditEvents = EMPTY_AUDIT_EVENTS
}: ExecutionConsoleProps) {
  const [state, setState] = useState<ExecutionConsoleState>(() =>
    buildInitialState(
      initialRun,
      initialArtifacts,
      initialLogs,
      initialPendingApprovals,
      initialCheckpoints,
      initialSelectedCheckpoint,
      initialAuditEvents
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
      const events = await refreshAuditTrail(resumed.run.id);

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
        auditEvents: sortAuditEvents(events),
        isResuming: false,
        resumeStatusMessage: {
          tone: "default",
          text: `Resume requested from checkpoint ${resumed.resumedFromCheckpointId}.`
        }
      }));
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
        initialCheckpoints,
        initialSelectedCheckpoint,
        initialAuditEvents
      )
    );
  }, [
    initialRun,
    initialArtifacts,
    initialLogs,
    initialPendingApprovals,
    initialCheckpoints,
    initialSelectedCheckpoint,
    initialAuditEvents
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

            void refreshAuditTrail(event.data.runId)
              .then((events) => {
                setState((latest) => ({
                  ...latest,
                  auditEvents: sortAuditEvents(events)
                }));
              })
              .catch(() => {
                setState((latest) => ({
                  ...latest,
                  resumeStatusMessage: {
                    tone: "error",
                    text: "Unable to refresh audit history after checkpoint capture."
                  }
                }));
              });

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

          if (event.type === "run.interrupted") {
            if (
              !current.currentRun ||
              current.selectedRunId !== event.data.run.id ||
              current.currentRun.id !== event.data.run.id
            ) {
              return current;
            }

            void refreshAuditTrail(event.data.run.id)
              .then((events) => {
                setState((latest) => ({
                  ...latest,
                  auditEvents: sortAuditEvents(events)
                }));
              })
              .catch(() => {
                setState((latest) => ({
                  ...latest,
                  resumeStatusMessage: {
                    tone: "error",
                    text: "Unable to refresh audit history after interruption."
                  }
                }));
              });

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

            void refreshAuditTrail(event.data.run.id)
              .then((events) => {
                setState((latest) => ({
                  ...latest,
                  auditEvents: sortAuditEvents(events)
                }));
              })
              .catch(() => {
                setState((latest) => ({
                  ...latest,
                  resumeStatusMessage: {
                    tone: "error",
                    text: "Unable to refresh audit history after resume."
                  }
                }));
              });

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

          return current;
        });
      });
    });
  }, [outcomeId]);

  return (
    <>
      <RunTimeline
        outcomeId={outcomeId}
        initialRun={state.currentRun}
        selectedRunId={state.selectedRunId}
        authProfiles={initialAuthProfiles}
      />
      {currentPendingApproval ? (
        <section className="rounded-[2rem] border border-amber-200/80 bg-amber-50/90 p-6 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">
                Blocked on review
              </p>
              <h2 className="font-serif text-3xl tracking-tight text-amber-950">
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
