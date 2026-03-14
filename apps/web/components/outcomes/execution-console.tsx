"use client";

import { startTransition, useEffect, useState } from "react";
import type {
  Artifact,
  AuthProfile,
  RunDetail,
  RunLogData
} from "@computer-oss/protocol";
import { subscribeToOutcomeEvents } from "../../lib/events";
import { ArtifactList } from "./artifact-list";
import { RunLogPanel } from "./run-log-panel";
import { RunTimeline } from "./run-timeline";

type ExecutionConsoleProps = {
  outcomeId: string;
  initialRun: RunDetail | null;
  initialArtifacts: Artifact[];
  initialLogs: RunLogData[];
  initialAuthProfiles?: AuthProfile[];
};

type ExecutionConsoleState = {
  selectedRunId: string | null;
  artifacts: Artifact[];
  logs: RunLogData[];
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
  initialLogs: RunLogData[]
): ExecutionConsoleState {
  return {
    selectedRunId: initialRun?.id ?? null,
    artifacts: sortArtifacts(initialArtifacts),
    logs: sortLogs(initialLogs)
  };
}

export function ExecutionConsole({
  outcomeId,
  initialRun,
  initialArtifacts,
  initialLogs,
  initialAuthProfiles = []
}: ExecutionConsoleProps) {
  const [state, setState] = useState<ExecutionConsoleState>(() =>
    buildInitialState(initialRun, initialArtifacts, initialLogs)
  );

  useEffect(() => {
    setState(buildInitialState(initialRun, initialArtifacts, initialLogs));
  }, [initialRun, initialArtifacts, initialLogs]);

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
              logs: current.selectedRunId === event.data.id ? current.logs : []
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
      <ArtifactList
        selectedRunId={state.selectedRunId}
        artifacts={state.artifacts}
      />
      <RunLogPanel selectedRunId={state.selectedRunId} logs={state.logs} />
    </>
  );
}
