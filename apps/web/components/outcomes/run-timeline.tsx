"use client";

import { startTransition, useEffect, useState } from "react";
import type {
  AuthProfile,
  RemoteStepLifecycleEventData,
  RunDetail,
  RunStep
} from "@computer-oss/protocol";
import { subscribeToOutcomeEvents } from "../../lib/events";
import {
  formatRouteReason,
  formatRouteStatus,
  routeStatusVariant
} from "../../lib/routing";
import { Badge } from "../ui/badge";

type RunTimelineProps = {
  outcomeId: string;
  initialRun: RunDetail | null;
  selectedRunId?: string | null;
  authProfiles?: AuthProfile[];
  remoteStepStates?: Record<string, RemoteStepLifecycleEventData>;
};

function sortSteps(steps: RunStep[]) {
  return [...steps].sort((left, right) => left.position - right.position);
}

function upsertStep(steps: RunStep[], incoming: RunStep) {
  const next = steps.some((step) => step.id === incoming.id)
    ? steps.map((step) => (step.id === incoming.id ? incoming : step))
    : [...steps, incoming];

  return sortSteps(next);
}

function statusVariant(status: string) {
  switch (status) {
    case "ready":
    case "completed":
      return "emerald";
    case "running":
    case "queued":
      return "sky";
    case "pending":
    case "blocked":
      return "amber";
    default:
      return "slate";
  }
}

type RunTimelineState = {
  pinnedRunId: string | null;
  run: RunDetail | null;
};

function resolveAuthProfileLabel(
  authProfiles: AuthProfile[],
  authProfileId: string | null | undefined
) {
  if (!authProfileId) {
    return null;
  }

  return authProfiles.find((profile) => profile.id === authProfileId)?.label ?? authProfileId;
}

export function RunTimeline({
  outcomeId,
  initialRun,
  selectedRunId = null,
  authProfiles = [],
  remoteStepStates = {}
}: RunTimelineProps) {
  const [state, setState] = useState<RunTimelineState>({
    pinnedRunId: selectedRunId ?? initialRun?.id ?? null,
    run: initialRun
  });
  const run = state.run;
  const authProfileLookup = new Map(
    authProfiles.map((profile) => [profile.id, profile.label])
  );

  useEffect(() => {
    setState((current) => {
      const nextPinnedRunId = selectedRunId ?? initialRun?.id ?? null;

      if (!nextPinnedRunId) {
        return {
          pinnedRunId: null,
          run: initialRun
        };
      }

      if (current.run && current.run.id === nextPinnedRunId) {
        return {
          pinnedRunId: nextPinnedRunId,
          run: current.run
        };
      }

      if (initialRun && initialRun.id === nextPinnedRunId) {
        return {
          pinnedRunId: nextPinnedRunId,
          run: initialRun
        };
      }

      return {
        pinnedRunId: nextPinnedRunId,
        run: null
      };
    });
  }, [initialRun, selectedRunId]);

  useEffect(() => {
    return subscribeToOutcomeEvents(outcomeId, (event) => {
      startTransition(() => {
        if (event.type === "run.created") {
          setState((current) => {
            if (current.pinnedRunId && current.pinnedRunId !== event.data.id) {
              return current;
            }

            return {
              pinnedRunId: event.data.id,
              run: {
                ...event.data,
                steps:
                  current.run && current.run.id === event.data.id
                    ? sortSteps(current.run.steps)
                    : []
              }
            };
          });
        }

        if (event.type === "run.step.updated") {
          setState((current) => {
            if (
              !current.run ||
              current.pinnedRunId !== event.data.runId ||
              current.run.id !== event.data.runId
            ) {
              return current;
            }

            return {
              ...current,
              run: {
                ...current.run,
                steps: upsertStep(current.run.steps, event.data)
              }
            };
          });
        }

        if (event.type === "run.updated") {
          setState((current) => {
            if (
              !current.run ||
              current.pinnedRunId !== event.data.id ||
              current.run.id !== event.data.id
            ) {
              return current;
            }

            return {
              ...current,
              run: {
                ...current.run,
                ...event.data,
                steps: sortSteps(current.run.steps)
              }
            };
          });
        }

        if (event.type === "run.interrupted" || event.type === "run.resumed") {
          setState((current) => {
            if (
              !current.run ||
              current.pinnedRunId !== event.data.run.id ||
              current.run.id !== event.data.run.id
            ) {
              return current;
            }

            return {
              ...current,
              run: {
                ...current.run,
                ...event.data.run,
                steps: sortSteps(current.run.steps)
              }
            };
          });
        }
      });
    });
  }, [outcomeId]);

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Run timeline
          </p>
          <h2 className="font-serif text-xl tracking-tight text-ink">
            Step materialization
          </h2>
          <p className="text-sm leading-6 text-muted">
            Initial step state is derived from dependency readiness and streamed over
            the outcome channel.
          </p>
        </div>
        {run ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
            <Badge variant="slate">{run.steps.length} steps</Badge>
          </div>
        ) : null}
      </div>

      {!run ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-shell px-5 py-8 text-sm leading-6 text-muted">
          Start a run to watch step state appear here.
        </div>
      ) : (
        <ol className="mt-6 space-y-4">
          {sortSteps(run.steps).map((step) => (
            <li
              key={step.id}
              className="relative overflow-hidden rounded-[1.6rem] border border-panel-line bg-surface-elevated px-5 py-4"
            >
              <div className="absolute left-0 top-0 h-full w-1.5 bg-[linear-gradient(180deg,transparent,var(--accent),transparent)]" />
              <div className="ml-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-ink">{step.title}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">
                      {step.kind} step
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="slate" size="sm">
                      {step.capability}
                    </Badge>
                    <Badge variant={statusVariant(step.status)} size="sm">
                      {step.status}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Position {step.position + 1}. Updated{" "}
                  {new Date(step.updatedAt).toLocaleTimeString()}.
                </p>
                {step.executionTarget === "remote_worker" ? (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="slate" size="sm">
                        remote worker
                      </Badge>
                      {step.remoteWorkerId ? (
                        <Badge variant="sky" size="sm">
                          {step.remoteWorkerId}
                        </Badge>
                      ) : null}
                      {remoteStepStates[step.id] ? (
                        <Badge
                          variant={statusVariant(remoteStepStates[step.id].status)}
                          size="sm"
                        >
                          {remoteStepStates[step.id].status}
                        </Badge>
                      ) : null}
                    </div>
                    {remoteStepStates[step.id]?.message ? (
                      <p className="text-sm leading-6 text-muted">
                        {remoteStepStates[step.id]?.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {step.routeStatus ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {step.routeProviderId ? (
                      <Badge size="sm">{step.routeProviderId}</Badge>
                    ) : null}
                    {step.routeModelId ? (
                      <Badge size="sm">{step.routeModelId}</Badge>
                    ) : null}
                    {resolveAuthProfileLabel(authProfiles, step.routeAuthProfileId) ? (
                      <Badge size="sm">
                        {authProfileLookup.get(step.routeAuthProfileId!) ??
                          step.routeAuthProfileId}
                      </Badge>
                    ) : null}
                    <Badge
                      variant={routeStatusVariant(step.routeStatus)}
                      size="sm"
                    >
                      {formatRouteStatus(step.routeStatus)}
                    </Badge>
                  </div>
                ) : null}
                {step.routeStatus && step.routeStatus !== "resolved" && step.routeReason ? (
                  <p className="mt-2 text-sm leading-6 text-amber-900">
                    {formatRouteReason(step.routeReason)}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
