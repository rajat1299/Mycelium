"use client";

import { startTransition, useEffect, useState } from "react";
import type {
  Approval,
  Artifact,
  ArtifactLineageEdge,
  AuthProfile,
  RunDetail,
  RunLogData
} from "@computer-oss/protocol";
import { subscribeToOutcomeEvents } from "../../lib/events";
import { ArtifactLineagePanel } from "./artifact-lineage-panel";
import { ArtifactList } from "./artifact-list";
import { Badge } from "../ui/badge";
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
};

type ExecutionConsoleState = {
  selectedRunId: string | null;
  artifacts: Artifact[];
  logs: RunLogData[];
  pendingApprovals: Approval[];
};

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

function buildInitialState(
  initialRun: RunDetail | null,
  initialArtifacts: Artifact[],
  initialLogs: RunLogData[],
  initialPendingApprovals: Approval[]
): ExecutionConsoleState {
  return {
    selectedRunId: initialRun?.id ?? null,
    artifacts: sortArtifacts(initialArtifacts),
    logs: sortLogs(initialLogs),
    pendingApprovals: initialPendingApprovals
  };
}

export function ExecutionConsole({
  outcomeId,
  initialRun,
  initialArtifacts,
  initialLogs,
  initialPendingApprovals = [],
  initialLineageEdges = [],
  initialAuthProfiles = []
}: ExecutionConsoleProps) {
  const [state, setState] = useState<ExecutionConsoleState>(() =>
    buildInitialState(
      initialRun,
      initialArtifacts,
      initialLogs,
      initialPendingApprovals
    )
  );
  const currentPendingApproval =
    state.pendingApprovals.find((approval) => approval.runId === state.selectedRunId) ??
    null;

  useEffect(() => {
    setState(
      buildInitialState(
        initialRun,
        initialArtifacts,
        initialLogs,
        initialPendingApprovals
      )
    );
  }, [initialRun, initialArtifacts, initialLogs, initialPendingApprovals]);

  useEffect(() => {
    return subscribeToOutcomeEvents(outcomeId, (event) => {
      startTransition(() => {
        setState((current) => {
          if (event.type === "run.created") {
            if (current.selectedRunId && current.selectedRunId !== event.data.id) {
              return current;
            }

            return {
              selectedRunId: event.data.id,
              artifacts:
                current.selectedRunId === event.data.id ? current.artifacts : [],
              logs: current.selectedRunId === event.data.id ? current.logs : [],
              pendingApprovals: current.pendingApprovals
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

          return current;
        });
      });
    });
  }, [outcomeId]);

  return (
    <>
      <RunTimeline
        outcomeId={outcomeId}
        initialRun={initialRun}
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
      <ArtifactLineagePanel
        selectedRunId={state.selectedRunId}
        artifacts={state.artifacts}
        edges={initialLineageEdges}
      />
      <ArtifactList
        selectedRunId={state.selectedRunId}
        artifacts={state.artifacts}
      />
      <RunLogPanel selectedRunId={state.selectedRunId} logs={state.logs} />
    </>
  );
}
