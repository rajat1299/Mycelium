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
import { cn } from "../ui/cn";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Download,
  FileCode2,
  FileText,
  Loader2,
  Monitor,
  Share2,
  Sparkles,
  Terminal,
  XCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ── Types ──────────────────────────────────────────────────────────── */

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

/* ── Utilities ──────────────────────────────────────────────────────── */

function sortArtifacts(artifacts: Artifact[]) {
  return [...artifacts].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
}

function upsertArtifact(artifacts: Artifact[], incoming: Artifact) {
  const next = artifacts.some((a) => a.id === incoming.id)
    ? artifacts.map((a) => (a.id === incoming.id ? incoming : a))
    : [...artifacts, incoming];
  return sortArtifacts(next);
}

function sortLogs(logs: RunLogData[]) {
  return [...logs].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
}

function logKey(log: RunLogData) {
  return [log.runId, log.stepId ?? "run", log.createdAt, log.level, log.message].join(":");
}

function appendLog(logs: RunLogData[], incoming: RunLogData) {
  if (logs.some((l) => logKey(l) === logKey(incoming))) return sortLogs(logs);
  return sortLogs([...logs, incoming]);
}

function sortSteps(steps: RunStep[]) {
  return [...steps].sort((left, right) => left.position - right.position);
}

function upsertStep(steps: RunStep[], incoming: RunStep) {
  const next = steps.some((s) => s.id === incoming.id)
    ? steps.map((s) => (s.id === incoming.id ? incoming : s))
    : [...steps, incoming];
  return sortSteps(next);
}

function sortMessages(messages: MessageCreatedData[]) {
  return [...messages].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
}

function appendMessage(messages: MessageCreatedData[], incoming: MessageCreatedData) {
  if (messages.some((m) => m.id === incoming.id)) return sortMessages(messages);
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

function fallbackIntroMessage(run: RunDetail | null) {
  if (!run)
    return "I\u2019ll start by loading relevant skills and searching my memory for any context about your work\u2026";
  if (run.status === "completed")
    return "The work is complete. The finished subtasks and final artifact are collected below.";
  if (run.status === "failed")
    return "The task stopped before it finished. The latest subtask states and failure context are shown below.";
  return "I\u2019ll start by loading relevant context, then break the work into focused subtasks and run them through the task feed below.";
}

function lastLogForStep(logs: RunLogData[], stepId: string) {
  return [...logs].reverse().find((l) => l.stepId === stepId);
}

function artifactsForStep(artifacts: Artifact[], stepId: string) {
  return artifacts.filter((a) => a.stepId === stepId);
}

function readMetadataString(artifact: Artifact | null, key: string) {
  if (!artifact) return null;
  const value = artifact.metadata[key];
  return typeof value === "string" ? value : null;
}

function readPreviewStats(artifact: Artifact | null) {
  if (!artifact) return [];
  const value = artifact.metadata.previewStats;
  if (!Array.isArray(value)) return [];
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

function formatByteSize(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}MB`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}KB`;
  return `${value}B`;
}

function displayWorkspacePath(relativePath: string) {
  const fileName = relativePath.split("/").filter(Boolean).at(-1) ?? relativePath;
  return `/home/user/workspace/${fileName}`;
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
  return { step, latestLog, artifacts: stepArtifacts, primaryArtifact, outputText };
}

function readErrorMessage(payload: unknown, action: "approve" | "reject") {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  )
    return payload.error;
  return action === "approve" ? "Failed to approve." : "Failed to reject.";
}

function formatStepTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

/* ── Easing ─────────────────────────────────────────────────────────── */

const ease = [0.25, 1, 0.5, 1] as const;

/* ── Main component ─────────────────────────────────────────────────── */

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
              return { ...current, plan: event.data };
            case "run.created":
              return {
                ...current,
                run:
                  current.run && current.run.id === event.data.id
                    ? { ...current.run, ...event.data }
                    : {
                        ...event.data,
                        steps:
                          current.run?.id === event.data.id
                            ? current.run.steps
                            : []
                      }
              };
            case "run.updated":
              if (!current.run || current.run.id !== event.data.id) return current;
              return { ...current, run: { ...current.run, ...event.data } };
            case "run.step.updated":
              if (!current.run || current.run.id !== event.data.runId) return current;
              return {
                ...current,
                run: { ...current.run, steps: upsertStep(current.run.steps, event.data) }
              };
            case "run.log":
              if (!current.run || current.run.id !== event.data.runId) return current;
              return { ...current, logs: appendLog(current.logs, event.data) };
            case "artifact.created":
              if (!current.run || current.run.id !== event.data.runId) return current;
              return { ...current, artifacts: upsertArtifact(current.artifacts, event.data) };
            case "approval.requested":
              return {
                ...current,
                pendingApprovals: current.pendingApprovals.some(
                  (a) => a.id === event.data.id
                )
                  ? current.pendingApprovals.map((a) =>
                      a.id === event.data.id ? event.data : a
                    )
                  : [...current.pendingApprovals, event.data]
              };
            case "approval.resolved":
              return {
                ...current,
                pendingApprovals: current.pendingApprovals.filter(
                  (a) => a.id !== event.data.id
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

  /* ── Derived ────────────────────────────────────────────────── */

  const currentApproval = state.run
    ? (state.pendingApprovals.find((a) => a.runId === state.run?.id) ?? null)
    : null;
  const approvalArtifacts = currentApproval
    ? state.artifacts.filter((a) => currentApproval.artifactIds.includes(a.id))
    : [];
  const stepLookup = new Map(
    (state.run?.steps ?? []).map((step) => [step.planNodeId, step])
  );
  const systemLogs = state.logs.filter((log) => !log.stepId);
  const introMessage = systemLogs[0]?.message ?? fallbackIntroMessage(state.run);
  const completionNarrative =
    state.run?.status === "completed" && systemLogs.length > 1
      ? (systemLogs.at(-1)?.message ?? null)
      : null;
  const middleNarratives = systemLogs.filter((log, index) => {
    if (index === 0) return false;
    if (completionNarrative && log.message === completionNarrative) return false;
    return true;
  });
  const orderedSteps = sortSteps(state.run?.steps ?? []);
  const promptPreview =
    showFullPrompt || outcomePrompt.length <= 280
      ? outcomePrompt
      : `${outcomePrompt.slice(0, 280).trimEnd()}\u2026`;
  const finalArtifact =
    [...state.artifacts].reverse().find((a) => a.kind === "result") ?? null;
  const stepCards = useMemo(
    () => orderedSteps.map((step) => buildStepCardData(step, state.logs, state.artifacts)),
    [orderedSteps, state.logs, state.artifacts]
  );

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="space-y-8">
      {/* ── User prompt — subtle elevated card ──────────────── */}
      <motion.div
        initial={{ opacity: 0, filter: "blur(4px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease }}
        className="rounded-2xl bg-surface-elevated/60 shadow-card px-5 py-4"
      >
        <p className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap">
          {promptPreview}
        </p>
        {outcomePrompt.length > 280 && (
          <button
            type="button"
            onClick={() => setShowFullPrompt((c) => !c)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            {showFullPrompt ? "Show less" : "Show more"}
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                showFullPrompt && "rotate-180"
              )}
            />
          </button>
        )}
      </motion.div>

      {/* ── AI intro — serif, directly on background ────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.5, ease, delay: 0.1 }}
      >
        <p className="font-serif text-lg leading-[1.65] text-ink sm:text-xl [text-wrap:pretty]">
          {introMessage}
        </p>
      </motion.div>

      {/* ── Plan checklist ──────────────────────────────────── */}
      {state.plan && (
        <PlanChecklist plan={state.plan} stepLookup={stepLookup} run={state.run} />
      )}

      {/* ── Middle narratives — serif, no card ──────────────── */}
      {middleNarratives.map((log) => (
        <motion.div
          key={logKey(log)}
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.4, ease }}
        >
          <p className="font-serif text-lg leading-[1.65] text-ink sm:text-xl [text-wrap:pretty]">
            {log.message}
          </p>
        </motion.div>
      ))}

      {/* ── Subtask output cards ────────────────────────────── */}
      {stepCards.length > 0 ? (
        <div className="space-y-4">
          {stepCards.map((card, index) => (
            <SubtaskOutputCard key={card.step.id} data={card} index={index} />
          ))}
        </div>
      ) : state.run ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease }}
          className="flex items-center gap-2 py-6 text-sm text-muted"
        >
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span>Preparing subtasks&hellip;</span>
        </motion.div>
      ) : null}

      {/* ── Inline approval ─────────────────────────────────── */}
      {currentApproval && (
        <InlineApprovalCard approval={currentApproval} artifacts={approvalArtifacts} />
      )}

      {/* ── Completion ──────────────────────────────────────── */}
      {(state.run?.status === "completed" || finalArtifact) && completionNarrative ? (
        <CompletionSection narrative={completionNarrative} artifact={finalArtifact} />
      ) : finalArtifact ? (
        <CompletionSection narrative={null} artifact={finalArtifact} />
      ) : null}

      {/* ── Follow-up messages ──────────────────────────────── */}
      {state.messages.length > 0 && (
        <div className="space-y-6 pt-2">
          {state.messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease }}
            >
              {message.role === "user" ? (
                <div className="rounded-2xl bg-surface-elevated/60 border border-panel-line/50 px-5 py-4">
                  <p className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-serif text-lg leading-[1.65] prose-feed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Plan Checklist ─────────────────────────────────────────────────── */

function PlanChecklist({
  plan,
  stepLookup,
  run
}: {
  plan: Plan;
  stepLookup: Map<string, RunStep>;
  run: RunDetail | null;
}) {
  const [open, setOpen] = useState(true);
  const nodes = plan.nodes.slice().sort((a, b) => a.position - b.position);

  const completedCount = nodes.filter((n) => {
    const step = stepLookup.get(n.id);
    return step?.status === "completed";
  }).length;

  const allDone = completedCount === nodes.length && nodes.length > 0;
  const label = allDone
    ? `All ${nodes.length} subtasks complete`
    : run?.status === "running"
      ? `Running ${nodes.length} subtasks`
      : `${nodes.length} subtasks planned`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease, delay: 0.15 }}
    >
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        className="flex w-full items-center gap-2.5 text-left group"
      >
        <Monitor className="h-4 w-4 shrink-0 text-muted" />
        <span className="flex-1 text-sm font-medium text-muted truncate">
          {label}
        </span>
        {completedCount > 0 && !allDone && (
          <span className="text-[11px] tabular-nums text-muted/60">
            {completedCount}/{nodes.length}
          </span>
        )}
        <ChevronUp
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted/50 transition-transform duration-200",
            !open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden"
          >
            <ol className="mt-3 ml-6 space-y-1.5 border-l border-panel-line/40 pl-4">
              {nodes.map((node) => {
                const step = stepLookup.get(node.id);
                const status = step?.status ?? "pending";

                return (
                  <li key={node.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 shrink-0">
                      {status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : status === "running" || status === "claimed" ? (
                        <Loader2 className="h-4 w-4 text-accent animate-spin" />
                      ) : status === "failed" ? (
                        <XCircle className="h-4 w-4 text-red-400" />
                      ) : (
                        <CircleDashed className="h-4 w-4 text-muted/40" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "leading-6",
                        status === "completed"
                          ? "text-muted line-through decoration-muted/30"
                          : status === "running" || status === "claimed"
                            ? "text-ink"
                            : "text-muted"
                      )}
                    >
                      {node.title}
                    </span>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Subtask Output Card ───────────────────────────────────────────── */

function SubtaskOutputCard({ data, index }: { data: StepCardData; index: number }) {
  const { step, latestLog, primaryArtifact, outputText } = data;
  const isRunning = step.status === "running" || step.status === "claimed";
  const isDone = step.status === "completed";
  const isFailed = step.status === "failed";
  const isBlocked = step.status === "blocked";

  const fileInfo = primaryArtifact
    ? {
        path: displayWorkspacePath(primaryArtifact.relativePath),
        lineCount:
          typeof primaryArtifact.metadata.lineCount === "number"
            ? primaryArtifact.metadata.lineCount
            : null,
        byteSize:
          typeof primaryArtifact.metadata.byteSize === "number"
            ? formatByteSize(primaryArtifact.metadata.byteSize)
            : null
      }
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease, delay: index * 0.08 }}
      className={cn(
        "overflow-hidden rounded-2xl transition-shadow duration-300",
        isRunning
          ? "shadow-card-active"
          : isFailed
            ? "shadow-card-error"
            : "shadow-card hover:shadow-card-hover"
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <Terminal className="h-4 w-4 shrink-0 text-muted" />
        <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {step.title}
        </h4>
        {step.routeModelId && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-panel-line/50 bg-surface-elevated px-2.5 py-1 text-[11px] font-medium text-muted">
            <Sparkles className="h-3 w-3" />
            <span>{step.routeModelId}</span>
          </div>
        )}
        {isDone && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted/60">
            {formatStepTime(step.updatedAt)}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="px-5 py-4 shadow-[inset_0_1px_0_var(--panel-line)]">
        {/* File metadata */}
        {fileInfo && (
          <p className="mb-3 text-sm text-muted">
            {isDone ? "Research complete. Saved to" : "Saving to"}{" "}
            <code className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-[12px] text-accent">
              {fileInfo.path}
            </code>
            {fileInfo.lineCount || fileInfo.byteSize ? (
              <span className="text-muted/60">
                {" \u2014 "}
                {[
                  fileInfo.lineCount ? `${fileInfo.lineCount} lines` : null,
                  fileInfo.byteSize
                ]
                  .filter(Boolean)
                  .join(", ")}
                .
              </span>
            ) : null}
          </p>
        )}

        {/* Content */}
        {isRunning && !outputText ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted">
            <span>Generating</span>
            <span className="flex gap-1">
              <span
                className="h-1.5 w-1.5 rounded-full bg-accent"
                style={{ animation: "streaming-dot 1.2s ease-in-out infinite 0ms" }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-accent"
                style={{ animation: "streaming-dot 1.2s ease-in-out infinite 200ms" }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-accent"
                style={{ animation: "streaming-dot 1.2s ease-in-out infinite 400ms" }}
              />
            </span>
          </div>
        ) : outputText ? (
          <div className="prose-feed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{outputText}</ReactMarkdown>
            {isRunning && (
              <span
                className="ml-1 inline-block h-4 w-1.5 bg-accent align-middle"
                style={{ animation: "blink-cursor 1s step-end infinite" }}
              />
            )}
          </div>
        ) : latestLog ? (
          <p className="text-sm leading-7 text-muted">{latestLog.message}</p>
        ) : (
          <p className="text-sm italic text-muted/60">
            {step.status === "pending" || step.status === "ready"
              ? "Waiting to start\u2026"
              : "No output yet."}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/* ── Inline Approval Card ──────────────────────────────────────────── */

function InlineApprovalCard({
  approval,
  artifacts
}: {
  approval: Approval;
  artifacts: Artifact[];
}) {
  const [inFlightAction, setInFlightAction] = useState<"approve" | "reject" | null>(null);
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolutionNote: null })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(readErrorMessage(payload, action));
      setStatusMessage({
        tone: "default",
        text:
          action === "approve"
            ? "Approval recorded. Continuing\u2026"
            : "Rejection recorded."
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        text: error instanceof Error ? error.message : `Failed to ${action}.`
      });
    } finally {
      setInFlightAction(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
      className="rounded-2xl border border-amber-300/30 bg-amber-50/30 p-5 dark:border-amber-500/20 dark:bg-amber-900/10"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-amber-700 dark:text-amber-400">
        <span
          className="h-2 w-2 rounded-full bg-amber-400"
          style={{ animation: "ping-slow 2s cubic-bezier(0,0,0.2,1) infinite" }}
        />
        <span>Approval required</span>
      </div>
      <h4 className="mt-2 text-sm font-semibold text-ink">{approval.title}</h4>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        {approval.instruction ?? "Approve to continue or reject to stop."}
      </p>

      {artifacts.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {artifacts.map((artifact) => (
            <li
              key={artifact.id}
              className="flex items-center gap-2 font-mono text-xs text-accent"
            >
              <FileCode2 className="h-3.5 w-3.5 text-muted" />
              <span>{displayWorkspacePath(artifact.relativePath)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => submitResolution("reject")}
          disabled={inFlightAction !== null}
          className="rounded-xl border border-panel-line px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface-elevated hover:text-ink disabled:opacity-50"
        >
          {inFlightAction === "reject" ? "Rejecting\u2026" : "Reject"}
        </button>
        <button
          type="button"
          onClick={() => submitResolution("approve")}
          disabled={inFlightAction !== null}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {inFlightAction === "approve" ? "Approving\u2026" : "Approve"}
        </button>
      </div>

      {statusMessage && (
        <p
          className={cn(
            "mt-3 text-sm",
            statusMessage.tone === "error" ? "text-red-500" : "text-muted"
          )}
        >
          {statusMessage.text}
        </p>
      )}
    </motion.div>
  );
}

/* ── Completion Section ────────────────────────────────────────────── */

function CompletionSection({
  narrative,
  artifact
}: {
  narrative: string | null;
  artifact: Artifact | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.5, ease }}
      className="space-y-6"
    >
      {/* Artifact thumbnail */}
      {artifact && <ArtifactPreviewCard artifact={artifact} />}

      {/* Completion narrative — serif */}
      {narrative && (
        <div className="prose-feed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{narrative}</ReactMarkdown>
        </div>
      )}
    </motion.div>
  );
}

/* ── Artifact Preview Card ─────────────────────────────────────────── */

function ArtifactPreviewCard({ artifact }: { artifact: Artifact }) {
  const previewStats = readPreviewStats(artifact);
  const summary =
    readMetadataString(artifact, "previewBody") ??
    readMetadataString(artifact, "summary") ??
    null;
  const title =
    readMetadataString(artifact, "title") ?? "Final report";
  const fileName =
    artifact.relativePath.split("/").filter(Boolean).at(-1) ?? artifact.relativePath;
  const fileType = artifact.kind === "result" ? "PDF Document" : artifact.kind;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 24 }}
      className="space-y-3"
    >
      {/* Thumbnail */}
      <div className="group relative overflow-hidden rounded-xl border border-panel-line bg-white">
        <div className="flex aspect-[4/3] max-h-[320px] items-center justify-center bg-gradient-to-br from-white to-slate-50 p-8">
          <div className="relative flex h-full w-auto max-w-[240px] flex-col rounded-sm bg-white p-6 shadow-lg ring-1 ring-slate-200/60 transition-transform duration-500 group-hover:scale-[1.02]">
            <div className="mb-4 h-3 w-2/3 rounded bg-slate-800/80" />
            <div className="mb-1 h-2 w-full rounded bg-slate-200/80" />
            <div className="mb-1 h-2 w-full rounded bg-slate-200/80" />
            <div className="mb-4 h-2 w-4/5 rounded bg-slate-200/80" />
            {previewStats.length > 0 && (
              <div className="mt-auto flex gap-3">
                {previewStats.slice(0, 4).map((stat) => (
                  <div
                    key={`${stat.label}:${stat.value}`}
                    className="flex flex-col items-center"
                  >
                    <span className="text-[8px] font-bold text-emerald-600">
                      {stat.value}
                    </span>
                    <span className="text-[5px] text-slate-400">{stat.label}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 h-1.5 w-full rounded bg-slate-100" />
            <div className="mt-1 h-1.5 w-full rounded bg-slate-100" />
          </div>
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{fileName}</p>
          <p className="text-xs text-muted">{fileType}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-elevated hover:text-ink"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-elevated hover:text-ink"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="prose-feed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
        </div>
      )}
    </motion.div>
  );
}
