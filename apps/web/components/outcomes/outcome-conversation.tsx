"use client";

import { startTransition, useEffect, useState } from "react";
import type {
  Approval,
  Artifact,
  OutcomeSource,
  Plan,
  RunDetail,
  RunLogData,
  RunStep
} from "@computer-oss/protocol";
import { subscribeToOutcomeEvents } from "../../lib/events";
import { Badge } from "../ui/badge";
import { cn } from "../ui/cn";

type OutcomeConversationProps = {
  outcomeId: string;
  outcomePrompt: string;
  outcomeSource: OutcomeSource;
  initialPlan: Plan | null;
  initialRun: RunDetail | null;
  initialArtifacts: Artifact[];
  initialLogs: RunLogData[];
  initialPendingApprovals: Approval[];
};

type OutcomeConversationState = {
  plan: Plan | null;
  run: RunDetail | null;
  artifacts: Artifact[];
  logs: RunLogData[];
  pendingApprovals: Approval[];
};

function sortArtifacts(artifacts: Artifact[]) {
  return [...artifacts].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
}

function upsertArtifact(artifacts: Artifact[], incoming: Artifact) {
  const next = artifacts.some((artifact) => artifact.id === incoming.id)
    ? artifacts.map((artifact) =>
        artifact.id === incoming.id ? incoming : artifact
      )
    : [...artifacts, incoming];

  return sortArtifacts(next);
}

function sortLogs(logs: RunLogData[]) {
  return [...logs].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
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

  return sortLogs([...logs, incoming]);
}

function sortSteps(steps: RunStep[]) {
  return [...steps].sort((left, right) => left.position - right.position);
}

function upsertStep(steps: RunStep[], incoming: RunStep) {
  const next = steps.some((step) => step.id === incoming.id)
    ? steps.map((step) => (step.id === incoming.id ? incoming : step))
    : [...steps, incoming];

  return sortSteps(next);
}

function buildInitialState(
  initialPlan: Plan | null,
  initialRun: RunDetail | null,
  initialArtifacts: Artifact[],
  initialLogs: RunLogData[],
  initialPendingApprovals: Approval[]
): OutcomeConversationState {
  return {
    plan: initialPlan,
    run: initialRun,
    artifacts: sortArtifacts(initialArtifacts),
    logs: sortLogs(initialLogs),
    pendingApprovals: initialPendingApprovals
  };
}

function runStatusVariant(status: string | undefined) {
  switch (status) {
    case "completed":
      return "emerald";
    case "running":
      return "sky";
    case "blocked":
    case "waiting_for_worker":
      return "amber";
    case "failed":
    case "cancelled":
      return "amber";
    default:
      return "slate";
  }
}

function stepStatusVariant(status: string) {
  switch (status) {
    case "completed":
      return "emerald";
    case "running":
    case "claimed":
      return "sky";
    case "ready":
      return "slate";
    case "blocked":
    case "failed":
    case "cancelled":
      return "amber";
    default:
      return "slate";
  }
}

function sourceLabel(source: OutcomeSource) {
  switch (source) {
    case "web":
      return "Web task";
    case "schedule":
      return "Scheduled task";
    case "slack":
      return "Slack task";
    case "telegram":
      return "Telegram task";
  }
}

function runSummary(run: RunDetail | null, approval: Approval | null) {
  if (!run) {
    return "Bootstrapping the task. The live execution stream will appear here as soon as the run materializes.";
  }

  if (run.status === "blocked" && approval) {
    return "Execution is paused on a review gate. Resolve the pending approval to let the run continue.";
  }

  if (run.status === "completed") {
    return "The run has finished. Final artifacts and step outputs remain pinned below for quick review.";
  }

  if (run.status === "failed") {
    return "The run failed before finishing. Inspect the latest step cards and operator console for the failure context.";
  }

  if (run.status === "queued" || run.status === "planning") {
    return "Mycelium is building the execution graph and preparing the run. Step cards will stream in as the state advances.";
  }

  return "Mycelium is actively working through the task. Step cards update in place as research, synthesis, and delivery progress.";
}

function lastLogForStep(logs: RunLogData[], stepId: string) {
  return [...logs]
    .reverse()
    .find((log) => log.stepId === stepId);
}

function artifactsForStep(artifacts: Artifact[], stepId: string) {
  return artifacts.filter((artifact) => artifact.stepId === stepId);
}

export function OutcomeConversation({
  outcomeId,
  outcomePrompt,
  outcomeSource,
  initialPlan,
  initialRun,
  initialArtifacts,
  initialLogs,
  initialPendingApprovals
}: OutcomeConversationProps) {
  const [state, setState] = useState<OutcomeConversationState>(() =>
    buildInitialState(
      initialPlan,
      initialRun,
      initialArtifacts,
      initialLogs,
      initialPendingApprovals
    )
  );

  useEffect(() => {
    setState(
      buildInitialState(
        initialPlan,
        initialRun,
        initialArtifacts,
        initialLogs,
        initialPendingApprovals
      )
    );
  }, [initialPlan, initialRun, initialArtifacts, initialLogs, initialPendingApprovals]);

  useEffect(() => {
    return subscribeToOutcomeEvents(outcomeId, (event) => {
      startTransition(() => {
        setState((current) => {
          switch (event.type) {
            case "plan.created":
              return {
                ...current,
                plan: event.data
              };
            case "run.created":
              return {
                ...current,
                run:
                  current.run && current.run.id === event.data.id
                    ? {
                        ...current.run,
                        ...event.data
                      }
                    : {
                        ...event.data,
                        steps: current.run?.id === event.data.id ? current.run.steps : []
                      }
              };
            case "run.updated":
              if (!current.run || current.run.id !== event.data.id) {
                return current;
              }

              return {
                ...current,
                run: {
                  ...current.run,
                  ...event.data
                }
              };
            case "run.step.updated":
              if (!current.run || current.run.id !== event.data.runId) {
                return current;
              }

              return {
                ...current,
                run: {
                  ...current.run,
                  steps: upsertStep(current.run.steps, event.data)
                }
              };
            case "run.log":
              if (!current.run || current.run.id !== event.data.runId) {
                return current;
              }

              return {
                ...current,
                logs: appendLog(current.logs, event.data)
              };
            case "artifact.created":
              if (!current.run || current.run.id !== event.data.runId) {
                return current;
              }

              return {
                ...current,
                artifacts: upsertArtifact(current.artifacts, event.data)
              };
            case "approval.requested":
              return {
                ...current,
                pendingApprovals: current.pendingApprovals.some(
                  (approval) => approval.id === event.data.id
                )
                  ? current.pendingApprovals
                  : [...current.pendingApprovals, event.data]
              };
            case "approval.resolved":
              return {
                ...current,
                pendingApprovals: current.pendingApprovals.filter(
                  (approval) => approval.id !== event.data.id
                )
              };
            default:
              return current;
          }
        });
      });
    });
  }, [outcomeId]);

  const currentApproval =
    state.run
      ? state.pendingApprovals.find((approval) => approval.runId === state.run?.id) ?? null
      : null;
  const stepLookup = new Map(
    (state.run?.steps ?? []).map((step) => [step.planNodeId, step])
  );
  const systemLogs = state.logs.filter((log) => !log.stepId);
  const orderedSteps = sortSteps(state.run?.steps ?? []);

  return (
    <section className="space-y-5 rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Working session
          </p>
          <h2 className="font-serif text-[1.65rem] leading-tight tracking-tight text-ink">
            Mycelium is handling the task from a single submit.
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-muted">
            {runSummary(state.run, currentApproval)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="slate">{sourceLabel(outcomeSource)}</Badge>
          <Badge variant={runStatusVariant(state.run?.status)}>
            {state.run?.status ?? "bootstrapping"}
          </Badge>
        </div>
      </div>

      <article className="rounded-[1.7rem] border border-panel-line bg-surface-elevated p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
          Original request
        </p>
        <p className="mt-3 text-base leading-7 text-ink">{outcomePrompt}</p>
      </article>

      {systemLogs.length > 0 ? (
        <div className="space-y-3">
          {systemLogs.map((log) => (
            <article
              key={logKey(log)}
              className="rounded-[1.55rem] border border-panel-line bg-[linear-gradient(135deg,rgba(204,125,94,0.10),rgba(255,255,253,0.82))] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                  System update
                </p>
                <span className="text-xs text-muted">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink">{log.message}</p>
            </article>
          ))}
        </div>
      ) : null}

      <article className="rounded-[1.7rem] border border-panel-line bg-surface-elevated p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Execution plan
            </p>
            <h3 className="mt-2 text-lg tracking-tight text-ink">
              Parallel task map
            </h3>
          </div>
          <Badge variant="slate">
            {(state.plan?.nodes.length ?? 0) > 0
              ? `${state.plan?.nodes.length ?? 0} steps`
              : "Waiting for plan"}
          </Badge>
        </div>

        {state.plan ? (
          <ol className="mt-4 space-y-3">
            {state.plan.nodes
              .slice()
              .sort((left, right) => left.position - right.position)
              .map((node) => {
                const step = stepLookup.get(node.id);

                return (
                  <li
                    key={node.id}
                    className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-panel-line bg-panel px-4 py-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-ink">{node.title}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">
                        {node.capability}
                      </p>
                    </div>
                    <Badge variant={stepStatusVariant(step?.status ?? "pending")} size="sm">
                      {step?.status ?? "pending"}
                    </Badge>
                  </li>
                );
              })}
          </ol>
        ) : (
          <div className="mt-4 rounded-[1.35rem] border border-dashed border-panel-line bg-panel px-4 py-5 text-sm leading-6 text-muted">
            The persisted draft plan will appear here as soon as orchestration completes.
          </div>
        )}
      </article>

      {currentApproval ? (
        <article className="rounded-[1.7rem] border border-amber-200 bg-amber-50/80 p-5 text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
                Waiting for review
              </p>
              <h3 className="mt-2 text-lg tracking-tight">{currentApproval.title}</h3>
            </div>
            <Badge variant="amber">Approval required</Badge>
          </div>
          <p className="mt-3 text-sm leading-6">{currentApproval.instruction}</p>
          <a
            href="/review"
            className="mt-4 inline-flex items-center rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold transition-colors hover:border-amber-400 hover:bg-amber-100"
          >
            Open review queue
          </a>
        </article>
      ) : null}

      <div className="space-y-4">
        {orderedSteps.length > 0 ? (
          orderedSteps.map((step) => {
            const latestLog = lastLogForStep(state.logs, step.id);
            const stepArtifacts = artifactsForStep(state.artifacts, step.id);

            return (
              <article
                key={step.id}
                className={cn(
                  "overflow-hidden rounded-[1.8rem] border border-panel-line bg-surface-elevated p-5 shadow-[0_10px_26px_rgba(45,40,30,0.04)]",
                  step.status === "running" && "border-accent/30"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                      Step {step.position + 1}
                    </p>
                    <h3 className="text-lg tracking-tight text-ink">{step.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="slate" size="sm">
                        {step.capability}
                      </Badge>
                      {step.routeModelId ? (
                        <Badge variant="sky" size="sm">
                          {step.routeModelId}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Badge variant={stepStatusVariant(step.status)}>{step.status}</Badge>
                </div>

                {latestLog ? (
                  <p className="mt-4 rounded-[1.2rem] border border-panel-line bg-panel px-4 py-3 text-sm leading-6 text-ink">
                    {latestLog.message}
                  </p>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-muted">
                    {step.status === "pending"
                      ? "Waiting for upstream work to finish before this step starts."
                      : step.status === "ready"
                        ? "Prepared and ready to start."
                        : "Streaming execution detail will appear here as the step advances."}
                  </p>
                )}

                {stepArtifacts.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {stepArtifacts.map((artifact) => (
                      <span
                        key={artifact.id}
                        className="rounded-full border border-panel-line bg-panel px-3 py-1.5 text-xs text-muted"
                      >
                        {artifact.relativePath}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <article className="rounded-[1.7rem] border border-dashed border-panel-line bg-surface-elevated px-5 py-8 text-sm leading-6 text-muted">
            The run has not materialized any steps yet. Once execution starts, step cards
            will appear here in order and update live.
          </article>
        )}
      </div>
    </section>
  );
}
