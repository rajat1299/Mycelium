"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
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

type StepCardData = {
  step: RunStep;
  latestLog: RunLogData | null;
  artifacts: Artifact[];
  primaryArtifact: Artifact | null;
  outputText: string | null;
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

function fallbackIntroMessage(run: RunDetail | null) {
  if (!run) {
    return "I’ll start by preparing the task, loading any relevant context, and building the first working subtasks.";
  }

  if (run.status === "completed") {
    return "The work is complete. The finished subtasks and final artifact are collected below.";
  }

  if (run.status === "failed") {
    return "The task stopped before it finished. The latest subtask states and failure context are shown below.";
  }

  return "I’ll start by loading relevant context, then break the work into focused subtasks and run them through the task feed below.";
}

function lastLogForStep(logs: RunLogData[], stepId: string) {
  return [...logs]
    .reverse()
    .find((log) => log.stepId === stepId);
}

function artifactsForStep(artifacts: Artifact[], stepId: string) {
  return artifacts.filter((artifact) => artifact.stepId === stepId);
}

function readMetadataString(
  artifact: Artifact | null,
  key: string
) {
  if (!artifact) {
    return null;
  }

  const value = artifact.metadata[key];
  return typeof value === "string" ? value : null;
}

function readPreviewStats(artifact: Artifact | null) {
  if (!artifact) {
    return [];
  }

  const value = artifact.metadata.previewStats;

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is { label: string; value: string } =>
      Boolean(
        item &&
          typeof item === "object" &&
          "label" in item &&
          typeof item.label === "string" &&
          "value" in item &&
          typeof item.value === "string"
      )
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

function displayWorkspacePath(relativePath: string) {
  const fileName = relativePath.split("/").filter(Boolean).at(-1) ?? relativePath;
  return `/home/user/workspace/${fileName}`;
}

function stripRichText(value: string) {
  return value.replace(/[#*_`>-]/g, " ").replace(/\s+/g, " ").trim();
}

function summarizeOutput(value: string) {
  const normalized = stripRichText(value);

  if (normalized.length <= 90) {
    return normalized;
  }

  return `${normalized.slice(0, 87).trimEnd()}...`;
}

function stepStatusCopy(status: RunStep["status"]) {
  switch (status) {
    case "completed":
      return "Done";
    case "running":
    case "claimed":
      return "Running";
    case "failed":
      return "Failed";
    case "blocked":
      return "Needs review";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}

function stepTone(status: RunStep["status"]) {
  switch (status) {
    case "completed":
      return "border-panel-line/70";
    case "running":
    case "claimed":
      return "border-accent/30 shadow-[0_0_18px_rgba(204,125,94,0.08)]";
    case "failed":
      return "border-amber-300/60";
    case "blocked":
      return "border-amber-200/90";
    default:
      return "border-panel-line/40 opacity-70";
  }
}

function buildStepCardData(
  step: RunStep,
  logs: RunLogData[],
  artifacts: Artifact[]
): StepCardData {
  const stepArtifacts = artifactsForStep(artifacts, step.id);
  const primaryArtifact = stepArtifacts.at(-1) ?? null;
  const previewBody = readMetadataString(primaryArtifact, "previewBody");
  const previewSummary = readMetadataString(primaryArtifact, "summary");
  const latestLog = lastLogForStep(logs, step.id) ?? null;
  const outputText = previewBody ?? previewSummary ?? latestLog?.message ?? null;

  return {
    step,
    latestLog,
    artifacts: stepArtifacts,
    primaryArtifact,
    outputText
  };
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
                  ? current.pendingApprovals.map((approval) =>
                      approval.id === event.data.id ? event.data : approval
                    )
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
  const approvalArtifacts = currentApproval
    ? state.artifacts.filter((artifact) => currentApproval.artifactIds.includes(artifact.id))
    : [];
  const stepLookup = new Map(
    (state.run?.steps ?? []).map((step) => [step.planNodeId, step])
  );
  const systemLogs = state.logs.filter((log) => !log.stepId);
  const introMessage = systemLogs[0]?.message ?? fallbackIntroMessage(state.run);
  const completionNarrative =
    state.run?.status === "completed" && systemLogs.length > 1
      ? systemLogs.at(-1)?.message ?? null
      : null;
  const middleNarratives = systemLogs.filter((log, index) => {
    if (index === 0) {
      return false;
    }

    if (completionNarrative && log.message === completionNarrative) {
      return false;
    }

    return true;
  });
  const orderedSteps = sortSteps(state.run?.steps ?? []);
  const promptPreview =
    showFullPrompt || outcomePrompt.length <= 220
      ? outcomePrompt
      : `${outcomePrompt.slice(0, 220).trimEnd()}...`;
  const finalArtifact =
    [...state.artifacts]
      .reverse()
      .find((artifact) => artifact.kind === "result") ?? null;
  const stepCards = useMemo(
    () => orderedSteps.map((step) => buildStepCardData(step, state.logs, state.artifacts)),
    [orderedSteps, state.logs, state.artifacts]
  );

  return (
    <section className="space-y-7">
      <article className="rounded-[1.75rem] border border-panel-line bg-panel px-6 py-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="slate">{sourceLabel(outcomeSource)}</Badge>
              <Badge variant={runStatusVariant(state.run?.status)}>
                {state.run?.status ?? "bootstrapping"}
              </Badge>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                Original request
              </p>
              <p className="mt-3 max-w-4xl text-[1.05rem] leading-8 text-ink">
                {promptPreview}
              </p>
            </div>
          </div>
          {outcomePrompt.length > 220 ? (
            <button
              type="button"
              onClick={() => setShowFullPrompt((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-panel-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              {showFullPrompt ? "Show less" : "Show more"}
              <ChevronIcon expanded={showFullPrompt} />
            </button>
          ) : null}
        </div>
      </article>

      <NarrativeMessage text={introMessage} prominent />

      {state.plan ? (
        <TaskChecklistCard plan={state.plan} stepLookup={stepLookup} />
      ) : null}

      {middleNarratives.map((log) => (
        <NarrativeMessage key={logKey(log)} text={log.message} />
      ))}

      <div className="space-y-4 sm:ml-10">
        <div className="relative space-y-4 border-l border-panel-line/60 pl-4 sm:pl-6">
          <div className="absolute inset-y-0 left-0 w-px -translate-x-px bg-gradient-to-b from-accent/25 via-panel-line to-transparent" />

          {stepCards.length > 0 ? (
            stepCards.map((stepCard) => (
              <TaskStepCard key={stepCard.step.id} data={stepCard} />
            ))
          ) : (
            <article className="rounded-[1.55rem] border border-dashed border-panel-line bg-surface-elevated px-5 py-6 text-sm leading-6 text-muted">
              Subtasks will appear here as the run materializes and starts execution.
            </article>
          )}

          {currentApproval ? (
            <InlineApprovalCard
              approval={currentApproval}
              artifacts={approvalArtifacts}
            />
          ) : null}
        </div>
      </div>

      {(state.run?.status === "completed" || finalArtifact) && completionNarrative ? (
        <CompletionSection
          narrative={completionNarrative}
          artifact={finalArtifact}
        />
      ) : finalArtifact ? (
        <CompletionSection narrative={null} artifact={finalArtifact} />
      ) : null}

      {state.messages.length > 0 ? (
        <div className="space-y-3">
          {state.messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                "max-w-3xl rounded-[1.55rem] px-5 py-4 shadow-panel",
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
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                {message.content}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TaskChecklistCard({
  plan,
  stepLookup
}: {
  plan: Plan;
  stepLookup: Map<string, RunStep>;
}) {
  const nodes = plan.nodes.slice().sort((left, right) => left.position - right.position);

  return (
    <article className="rounded-[1.7rem] border border-panel-line bg-panel px-6 py-5 shadow-panel sm:ml-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            Task checklist
          </p>
          <h3 className="mt-2 text-lg tracking-tight text-ink">
            Running the task through structured subtasks
          </h3>
        </div>
        <Badge variant="slate">{nodes.length} steps</Badge>
      </div>

      <ol className="mt-5 space-y-3">
        {nodes.map((node) => {
          const step = stepLookup.get(node.id);
          const status = step?.status ?? "pending";

          return (
            <li key={node.id} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 text-muted">
                <StatusIcon status={status} size={16} />
              </span>
              <span
                className={cn(
                  "leading-6 text-ink",
                  status === "completed" && "text-muted line-through"
                )}
              >
                {node.title}
              </span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function NarrativeMessage({
  text,
  prominent = false
}: {
  text: string;
  prominent?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 sm:ml-4">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent-soft text-accent">
        <BrainIcon />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p
          className={cn(
            "max-w-3xl leading-relaxed text-ink",
            prominent
              ? "font-serif text-[1.55rem] tracking-tight"
              : "text-[1.02rem]"
          )}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

function TaskStepCard({ data }: { data: StepCardData }) {
  const { step, latestLog, primaryArtifact, outputText } = data;
  const [open, setOpen] = useState(
    step.status === "running" || step.status === "failed" || step.status === "blocked"
  );
  const collapsedPreview =
    step.status === "completed" && outputText ? summarizeOutput(outputText) : null;

  useEffect(() => {
    if (step.status === "running" || step.status === "failed" || step.status === "blocked") {
      setOpen(true);
    }
  }, [step.status]);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[1.6rem] border bg-panel shadow-panel transition-all duration-200",
        stepTone(step.status)
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-sidebar-hover/60"
      >
        <div className="min-w-0 flex items-start gap-4">
          <div className="mt-0.5 shrink-0 text-muted">
            <StatusIcon status={step.status} size={18} animated={step.status === "running"} />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold tracking-tight text-ink sm:text-base">
              {step.title}
            </h4>
            {collapsedPreview && !open ? (
              <p className="mt-1 truncate text-xs text-muted sm:text-sm">
                {collapsedPreview}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {step.routeModelId ? (
            <div className="hidden items-center gap-1.5 rounded-full border border-panel-line bg-surface-elevated px-3 py-1 text-[11px] font-medium text-muted sm:flex">
              <CpuIcon />
              <span>{step.routeModelId}</span>
            </div>
          ) : null}
          <Badge variant={badgeVariantForStep(step.status)} size="sm">
            {stepStatusCopy(step.status)}
          </Badge>
          <span className="text-muted">
            <ChevronIcon expanded={open} />
          </span>
        </div>
      </button>

      {open ? (
        <div className="border-t border-panel-line/70 bg-surface-elevated/70 px-5 py-5">
          {primaryArtifact ? (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[1rem] border border-panel-line bg-panel px-4 py-3 shadow-[inset_0_1px_0_var(--panel-line)]">
              <div className="flex items-center gap-2 text-xs font-mono text-accent">
                <FileCodeIcon />
                <span>{displayWorkspacePath(primaryArtifact.relativePath)}</span>
              </div>
              <div className="flex items-center gap-1.5 border-l border-panel-line pl-3 text-xs text-muted">
                <FileDigitIcon />
                <span>{describeArtifactMeta(primaryArtifact)}</span>
              </div>
            </div>
          ) : null}

          {step.status === "running" && !outputText ? (
            <div className="flex items-center gap-2 px-1 py-4 text-sm text-muted">
              <span>Generating</span>
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:240ms]" />
              </span>
            </div>
          ) : outputText ? (
            <RichText text={outputText} />
          ) : latestLog ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-muted">
              {latestLog.message}
            </p>
          ) : (
            <p className="text-sm italic leading-7 text-muted">
              {step.status === "pending" || step.status === "ready"
                ? "No output yet. This subtask is waiting to start."
                : "No output has been persisted for this subtask yet."}
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function InlineApprovalCard({
  approval,
  artifacts
}: {
  approval: Approval;
  artifacts: Artifact[];
}) {
  const [inFlightAction, setInFlightAction] = useState<"approve" | "reject" | null>(
    null
  );
  const [statusMessage, setStatusMessage] = useState<{
    tone: "default" | "error";
    text: string;
  } | null>(null);

  async function submitResolution(action: "approve" | "reject") {
    setInFlightAction(action);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/approvals/${approval.id}/${action}`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          resolutionNote: null
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(readErrorMessage(payload, action));
      }

      setStatusMessage({
        tone: "default",
        text:
          action === "approve"
            ? "Approval recorded. The task feed will continue when the live update lands."
            : "Rejection recorded. The task feed will update when the live state changes."
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : action === "approve"
              ? "Failed to approve pending review."
              : "Failed to reject pending review."
      });
    } finally {
      setInFlightAction(null);
    }
  }

  return (
    <article className="rounded-[1.6rem] border border-amber-200 bg-amber-50/90 px-5 py-5 text-amber-950 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
            Approval required
          </p>
          <h4 className="mt-2 text-lg tracking-tight text-amber-950">{approval.title}</h4>
        </div>
        <Badge variant="amber">Blocked</Badge>
      </div>

      <p className="mt-3 text-sm leading-7">
        {approval.instruction ?? "Approve to continue this task or reject to stop it."}
      </p>

      {artifacts.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {artifacts.map((artifact) => (
            <li
              key={artifact.id}
              className="rounded-[1rem] border border-amber-200/70 bg-white/70 px-4 py-3 text-sm"
            >
              <p className="font-medium text-amber-950">
                {displayWorkspacePath(artifact.relativePath)}
              </p>
              <p className="mt-1 text-xs text-amber-700">{describeArtifactMeta(artifact)}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => submitResolution("reject")}
          disabled={inFlightAction !== null}
          className="rounded-full border border-amber-300 bg-transparent px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {inFlightAction === "reject" ? "Rejecting" : "Reject"}
        </button>
        <button
          type="button"
          onClick={() => submitResolution("approve")}
          disabled={inFlightAction !== null}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {inFlightAction === "approve" ? "Approving" : "Approve"}
        </button>
      </div>

      {statusMessage ? (
        <p
          className={cn(
            "mt-4 text-sm leading-6",
            statusMessage.tone === "error" ? "text-amber-900" : "text-amber-800"
          )}
        >
          {statusMessage.text}
        </p>
      ) : null}
    </article>
  );
}

function CompletionSection({
  narrative,
  artifact
}: {
  narrative: string | null;
  artifact: Artifact | null;
}) {
  return (
    <section className="pt-4 sm:ml-10">
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <StatusIcon status="completed" size={14} />
        </div>
        <h3 className="text-base font-semibold tracking-tight text-ink">
          Execution Complete
        </h3>
      </div>

      {narrative ? (
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">{narrative}</p>
      ) : null}

      {artifact ? <ArtifactDeliveryCard artifact={artifact} /> : null}
    </section>
  );
}

function ArtifactDeliveryCard({ artifact }: { artifact: Artifact }) {
  const previewStats = readPreviewStats(artifact);
  const deliverySummary =
    readMetadataString(artifact, "previewBody") ??
    readMetadataString(artifact, "summary") ??
    "The final deliverable is ready.";

  return (
    <article className="mt-6 overflow-hidden rounded-[1.75rem] border border-panel-line bg-panel shadow-panel">
      <div className="grid gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="border-b border-panel-line bg-[#f5f6f8] p-6 md:border-b-0 md:border-r">
          <div className="rounded-[1.2rem] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
            <p className="text-3xl font-semibold tracking-tight">
              {readMetadataString(artifact, "title") ?? "Final report"}
            </p>
            <p className="mt-3 text-sm text-slate-500">PDF Document</p>

            {previewStats.length > 0 ? (
              <div className="mt-8 grid grid-cols-2 gap-3">
                {previewStats.map((stat) => (
                  <div key={`${stat.label}:${stat.value}`} className="rounded-2xl bg-slate-100 px-4 py-3">
                    <p className="text-2xl font-semibold text-blue-700">{stat.value}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                {artifact.relativePath.split("/").filter(Boolean).at(-1) ?? artifact.relativePath}
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

          <RichText text={deliverySummary} large />
        </div>
      </div>
    </article>
  );
}

function RichText({
  text,
  large = false
}: {
  text: string;
  large?: boolean;
}) {
  const sections = text
    .trim()
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  return (
    <div className={cn("space-y-4", large && "text-[1.02rem]")}>
      {sections.map((section, index) => {
        const lines = section
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length === 0) {
          return null;
        }

        const heading = normalizeRichLine(lines[0]);
        const remaining = lines.slice(1);
        const bulletLines = lines.filter((line) => isBulletLine(line));

        if (bulletLines.length === lines.length) {
          return (
            <ul key={index} className="space-y-2 pl-5 text-sm leading-7 text-ink">
              {bulletLines.map((line) => (
                <li key={line} className="list-disc">
                  {normalizeRichLine(line)}
                </li>
              ))}
            </ul>
          );
        }

        if (remaining.length > 0 && remaining.every((line) => isBulletLine(line))) {
          return (
            <div key={index} className="space-y-2">
              <p className={cn("font-semibold text-ink", large ? "text-lg" : "text-sm")}>
                {heading}
              </p>
              <ul className="space-y-2 pl-5 text-sm leading-7 text-ink">
                {remaining.map((line) => (
                  <li key={line} className="list-disc">
                    {normalizeRichLine(line)}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        if (lines.every((line) => isNumberedLine(line))) {
          return (
            <ol key={index} className="space-y-2 pl-5 text-sm leading-7 text-ink">
              {lines.map((line) => (
                <li key={line} className="list-decimal">
                  {normalizeRichLine(line)}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p
            key={index}
            className={cn(
              "whitespace-pre-wrap leading-7 text-ink",
              large ? "text-[1.02rem]" : "text-sm"
            )}
          >
            {lines.map(normalizeRichLine).join("\n")}
          </p>
        );
      })}
    </div>
  );
}

function normalizeRichLine(line: string) {
  return line
    .replace(/^#{1,3}\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .trim();
}

function isBulletLine(line: string) {
  return /^[-*]\s+/.test(line);
}

function isNumberedLine(line: string) {
  return /^\d+\.\s+/.test(line);
}

function badgeVariantForStep(status: RunStep["status"]) {
  switch (status) {
    case "completed":
      return "emerald";
    case "running":
    case "claimed":
      return "sky";
    case "blocked":
    case "failed":
      return "amber";
    default:
      return "slate";
  }
}

function readErrorMessage(payload: unknown, action: "approve" | "reject") {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return action === "approve"
    ? "Failed to approve pending review."
    : "Failed to reject pending review.";
}

function StatusIcon({
  status,
  size = 18,
  animated = false
}: {
  status: string;
  size?: number;
  animated?: boolean;
}) {
  if (status === "completed") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-600"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }

  if (status === "running" || status === "claimed") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("text-accent", animated && "animate-spin")}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    );
  }

  if (status === "failed" || status === "cancelled" || status === "blocked") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-amber-600"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted"
    >
      <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2A3.5 3.5 0 0 0 6 5.5V7a2.5 2.5 0 0 0-2 2.45A2.5 2.5 0 0 0 5.5 12 2.5 2.5 0 0 0 4 14.55 2.5 2.5 0 0 0 6.5 17H7a3 3 0 0 0 3 3" />
      <path d="M14.5 2A3.5 3.5 0 0 1 18 5.5V7a2.5 2.5 0 0 1 2 2.45A2.5 2.5 0 0 1 18.5 12 2.5 2.5 0 0 1 20 14.55 2.5 2.5 0 0 1 17.5 17H17a3 3 0 0 1-3 3" />
      <path d="M12 2v20M9 8.5h3M12 8.5h3M9 15.5h3M12 15.5h3" />
    </svg>
  );
}

function CpuIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  );
}

function FileCodeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M10 13 8 15l2 2M14 13l2 2-2 2" />
    </svg>
  );
}

function FileDigitIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M10 12h2v6M10 18h4" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {expanded ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}
