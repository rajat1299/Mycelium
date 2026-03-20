"use client";

import { startTransition, useEffect, useState } from "react";
import type {
  Approval,
  Artifact,
  MessageCreatedData,
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
  messages: MessageCreatedData[];
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
    pendingApprovals: initialPendingApprovals,
    messages: []
  };
}

function sortMessages(messages: MessageCreatedData[]) {
  return [...messages].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
}

function appendMessage(
  messages: MessageCreatedData[],
  incoming: MessageCreatedData
) {
  if (messages.some((message) => message.id === incoming.id)) {
    return sortMessages(messages);
  }

  return sortMessages([...messages, incoming]);
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
  const [showFullPrompt, setShowFullPrompt] = useState(false);

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
            case "message.created":
              return {
                ...current,
                messages: appendMessage(current.messages, event.data)
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
  const finalArtifact =
    [...state.artifacts]
      .reverse()
      .find((artifact) => artifact.kind === "result") ?? null;
  const promptPreview =
    showFullPrompt || outcomePrompt.length <= 220
      ? outcomePrompt
      : `${outcomePrompt.slice(0, 220).trimEnd()}...`;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Working session
          </p>
          <p className="max-w-3xl font-serif text-[2rem] leading-[1.35] tracking-tight text-ink">
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

      <article className="rounded-[1.8rem] border border-panel-line bg-panel px-6 py-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Original request
            </p>
            <p className="max-w-4xl text-[1.05rem] leading-8 text-ink">
              {promptPreview}
            </p>
          </div>
          {outcomePrompt.length > 220 ? (
            <button
              type="button"
              onClick={() => setShowFullPrompt((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-panel-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              {showFullPrompt ? "Show less" : "Show more"}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {showFullPrompt ? (
                  <path d="m18 15-6-6-6 6" />
                ) : (
                  <path d="m6 9 6 6 6-6" />
                )}
              </svg>
            </button>
          ) : null}
        </div>
      </article>

      {systemLogs.length > 0 ? (
        <div className="space-y-3">
          {systemLogs.map((log) => (
            <article
              key={logKey(log)}
              className="rounded-[1.55rem] border border-panel-line bg-[linear-gradient(135deg,rgba(204,125,94,0.08),rgba(255,255,253,0.84))] px-6 py-5 shadow-panel"
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

      <article className="rounded-[1.7rem] border border-panel-line bg-panel px-6 py-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Execution plan
            </p>
            <h3 className="mt-2 text-lg tracking-tight text-ink">
              Starting parallel research across all topics
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
                  "overflow-hidden rounded-[1.8rem] border border-panel-line bg-panel px-6 py-5 shadow-panel",
                  step.status === "running" && "border-accent/30"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-panel-line bg-surface-elevated text-muted">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                          <path d="M8 21h8m-4-4v4" />
                        </svg>
                      </span>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                          Step {step.position + 1}
                        </p>
                        <h3 className="text-lg tracking-tight text-ink">{step.title}</h3>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {step.routeModelId ? (
                        <Badge variant="sky" size="sm">
                          {step.routeModelId}
                        </Badge>
                      ) : null}
                      <Badge variant="slate" size="sm">
                        {step.capability}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={stepStatusVariant(step.status)}>{step.status}</Badge>
                    {latestLog ? (
                      <span className="text-xs text-muted">
                        {new Date(latestLog.createdAt).toLocaleTimeString()}
                      </span>
                    ) : null}
                  </div>
                </div>

                {latestLog ? (
                  <p className="mt-4 rounded-[1.35rem] border border-panel-line bg-surface-elevated px-4 py-3 text-sm leading-6 text-ink">
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
                  <div className="mt-4 space-y-3">
                    {stepArtifacts.map((artifact) => (
                      <div
                        key={artifact.id}
                        className="rounded-[1.35rem] border border-panel-line bg-surface-elevated px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-sm font-medium text-ink">
                            {artifact.relativePath}
                          </span>
                          <span className="text-xs text-muted">
                            {describeArtifactMeta(artifact)}
                          </span>
                        </div>
                        {typeof artifact.metadata.summary === "string" ? (
                          <p className="mt-3 text-sm leading-6 text-muted">
                            {artifact.metadata.summary}
                          </p>
                        ) : null}
                      </div>
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

      {state.messages.length > 0 ? (
        <div className="space-y-3">
          {state.messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                "max-w-3xl rounded-[1.6rem] px-5 py-4 shadow-panel",
                message.role === "user"
                  ? "ml-auto border border-accent/20 bg-accent-soft text-ink"
                  : "border border-panel-line bg-panel text-ink"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                  {message.role === "user" ? "Follow-up" : message.role}
                </p>
                <span className="text-xs text-muted">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7">{message.content}</p>
            </article>
          ))}
        </div>
      ) : null}

      {finalArtifact ? (
        <article className="rounded-[1.9rem] border border-panel-line bg-panel px-6 py-6 shadow-panel">
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-[1.7rem] border border-panel-line bg-white p-5 text-slate-900 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
              <p className="text-3xl font-semibold tracking-tight">
                {typeof finalArtifact.metadata.title === "string"
                  ? finalArtifact.metadata.title
                  : "Final report"}
              </p>
              <p className="mt-3 text-sm text-slate-500">PDF Document</p>
              {Array.isArray(finalArtifact.metadata.previewStats) ? (
                <div className="mt-8 grid grid-cols-2 gap-3">
                  {finalArtifact.metadata.previewStats.map((stat, index) => {
                    if (
                      !stat ||
                      typeof stat !== "object" ||
                      !("label" in stat) ||
                      !("value" in stat)
                    ) {
                      return null;
                    }

                    return (
                      <div
                        key={`${finalArtifact.id}:${index}`}
                        className="rounded-2xl bg-slate-100 px-4 py-3"
                      >
                        <p className="text-2xl font-semibold text-blue-700">
                          {String(stat.value)}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                          {String(stat.label)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {finalArtifact.relativePath}
                  </p>
                  <p className="text-sm text-muted">PDF Document</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-panel-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-panel-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
                  >
                    Download
                  </button>
                </div>
              </div>
              <p className="font-serif text-[1.75rem] leading-[1.35] tracking-tight text-ink">
                Here&apos;s your report. The final artifact is ready inline with its
                summary and delivery details.
              </p>
              {typeof finalArtifact.metadata.summary === "string" ? (
                <p className="text-base leading-8 text-ink">
                  {finalArtifact.metadata.summary}
                </p>
              ) : null}
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}

function describeArtifactMeta(artifact: Artifact) {
  const lineCount =
    typeof artifact.metadata.lineCount === "number"
      ? `${artifact.metadata.lineCount} lines`
      : null;
  const byteSize =
    typeof artifact.metadata.byteSize === "number"
      ? formatByteSize(artifact.metadata.byteSize)
      : null;

  return [lineCount, byteSize].filter(Boolean).join(", ") || artifact.kind;
}

function formatByteSize(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}MB`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}KB`;
  }

  return `${value}B`;
}
