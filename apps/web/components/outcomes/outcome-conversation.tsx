"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
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
  CircleDashed,
  FileCode2,
  Loader2,
  Monitor,
  Sparkles,
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

type FeedItem =
  | { type: "prompt"; key: string }
  | { type: "narrative"; key: string; message: string }
  | { type: "action-group"; key: string; title: string; items: ActionGroupItemData[] }
  | { type: "subtask"; key: string; data: StepCardData }
  | { type: "approval"; key: string; approval: Approval; artifacts: Artifact[] }
  | { type: "message"; key: string; message: MessageCreatedData }
  | { type: "loading"; key: string };

type ActionGroupItemData = {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed";
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

function formatStepTimestamp(step: RunStep) {
  const time = new Date(step.updatedAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
  if (step.status !== "completed") return time;
  const ms = new Date(step.updatedAt).getTime() - new Date(step.createdAt).getTime();
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${time} \u00b7 ${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${time} \u00b7 ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${time} \u00b7 ${hours}h ${minutes % 60}m`;
}

function normalizeStepStatus(status: string): ActionGroupItemData["status"] {
  if (status === "completed") return "completed";
  if (status === "running" || status === "claimed") return "running";
  if (status === "failed") return "failed";
  return "pending";
}

/* ── Feed Timeline Builder ─────────────────────────────────────────── */

function buildFeedTimeline(
  state: OutcomeConversationState,
  systemLogs: RunLogData[],
  stepCards: StepCardData[]
): FeedItem[] {
  const items: FeedItem[] = [];
  const stepLookup = new Map(
    (state.run?.steps ?? []).map((step) => [step.planNodeId, step])
  );

  /* 1. User prompt */
  items.push({ type: "prompt", key: "prompt" });

  /* 2. AI intro — content-aware key so it re-streams when SSE replaces fallback */
  const introMessage = systemLogs[0]?.message ?? fallbackIntroMessage(state.run);
  items.push({
    type: "narrative",
    key: `intro:${introMessage.slice(0, 40)}`,
    message: introMessage
  });

  /* 3. Plan action group */
  if (state.plan) {
    const nodes = state.plan.nodes.slice().sort((a, b) => a.position - b.position);
    const completedCount = nodes.filter((n) =>
      stepLookup.get(n.id)?.status === "completed"
    ).length;
    const allDone = completedCount === nodes.length && nodes.length > 0;
    const title = allDone
      ? `All ${nodes.length} subtasks complete`
      : state.run?.status === "running"
        ? `Running ${nodes.length} subtasks`
        : `${nodes.length} subtasks planned`;

    items.push({
      type: "action-group",
      key: "plan",
      title,
      items: nodes.map((node) => ({
        id: node.id,
        title: node.title,
        status: normalizeStepStatus(stepLookup.get(node.id)?.status ?? "pending")
      }))
    });
  }

  /* 4. Merge remaining system logs + step cards chronologically */
  type ChronoEntry = { timestamp: string; item: FeedItem };
  const chronoEntries: ChronoEntry[] = [];

  for (const log of systemLogs.slice(1)) {
    chronoEntries.push({
      timestamp: log.createdAt,
      item: { type: "narrative", key: `log:${logKey(log)}`, message: log.message }
    });
  }

  for (const card of stepCards) {
    chronoEntries.push({
      timestamp: card.step.createdAt,
      item: { type: "subtask", key: `step:${card.step.id}`, data: card }
    });
  }

  chronoEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  items.push(...chronoEntries.map((e) => e.item));

  /* 5. Loading spinner when run exists but no steps yet */
  if (state.run && stepCards.length === 0) {
    items.push({ type: "loading", key: "loading" });
  }

  /* 6. Approval */
  const currentApproval = state.run
    ? (state.pendingApprovals.find((a) => a.runId === state.run?.id) ?? null)
    : null;
  if (currentApproval) {
    items.push({
      type: "approval",
      key: `approval:${currentApproval.id}`,
      approval: currentApproval,
      artifacts: state.artifacts.filter((a) =>
        currentApproval.artifactIds.includes(a.id)
      )
    });
  }

  /* 7. Follow-up messages */
  for (const msg of state.messages) {
    items.push({ type: "message", key: `msg:${msg.id}`, message: msg });
  }

  return items;
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

  /* Keys present at first render — anything NOT in this set arrived via SSE */
  const mountKeysRef = useRef<Set<string> | null>(null);

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
                run: {
                  ...current.run,
                  steps: upsertStep(current.run.steps, event.data)
                }
              };
            case "run.log":
              if (!current.run || current.run.id !== event.data.runId) return current;
              return { ...current, logs: appendLog(current.logs, event.data) };
            case "artifact.created":
              if (!current.run || current.run.id !== event.data.runId) return current;
              return {
                ...current,
                artifacts: upsertArtifact(current.artifacts, event.data)
              };
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

  const promptPreview =
    showFullPrompt || outcomePrompt.length <= 280
      ? outcomePrompt
      : `${outcomePrompt.slice(0, 280).trimEnd()}\u2026`;

  const isLive = !state.run || ["running", "queued", "blocked"].includes(state.run.status);

  const feedItems = useMemo(() => {
    const systemLogs = state.logs.filter((log) => !log.stepId);
    const orderedSteps = sortSteps(state.run?.steps ?? []);
    const stepCards = orderedSteps.map((step) =>
      buildStepCardData(step, state.logs, state.artifacts)
    );
    return buildFeedTimeline(state, systemLogs, stepCards);
  }, [state]);

  /* Snapshot on first render */
  if (mountKeysRef.current === null) {
    mountKeysRef.current = new Set(feedItems.map((item) => item.key));
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-6">
      {feedItems.map((item, index) => {
        const isFromSSE = !(mountKeysRef.current?.has(item.key) ?? true);
        const delay = isFromSSE ? 0 : Math.min(index * 0.06, 0.5);

        switch (item.type) {
          case "prompt":
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, x: 12, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.4, ease }}
                className="flex justify-end"
              >
                <div className="max-w-[85%] rounded-2xl rounded-br-lg bg-accent-soft px-5 py-3.5">
                  <p className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap [text-wrap:pretty]">
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
                </div>
              </motion.div>
            );

          case "narrative":
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.5, ease, delay }}
              >
                <p className="font-serif text-lg leading-[1.65] text-ink sm:text-xl [text-wrap:pretty]">
                  {isLive && isFromSSE ? (
                    <StreamingText text={item.message} />
                  ) : (
                    item.message
                  )}
                </p>
              </motion.div>
            );

          case "action-group":
            return (
              <ActionGroup
                key={item.key}
                title={item.title}
                items={item.items}
                delay={delay}
              />
            );

          case "subtask":
            return (
              <SubtaskOutputCard
                key={item.key}
                data={item.data}
                delay={delay}
              />
            );

          case "approval":
            return (
              <InlineApprovalCard
                key={item.key}
                approval={item.approval}
                artifacts={item.artifacts}
              />
            );

          case "message":
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease }}
              >
                {item.message.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-lg bg-accent-soft px-5 py-3.5">
                      <p className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap [text-wrap:pretty]">
                        {item.message.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="prose-feed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {item.message.content}
                    </ReactMarkdown>
                  </div>
                )}
              </motion.div>
            );

          case "loading":
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, ease }}
                className="flex items-center gap-2 py-6 text-sm text-muted"
              >
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span>Preparing subtasks&hellip;</span>
              </motion.div>
            );
        }
      })}
    </div>
  );
}

/* ── Action Group ──────────────────────────────────────────────────── */

function ActionGroup({
  title,
  items,
  delay
}: {
  title: string;
  items: ActionGroupItemData[];
  delay: number;
}) {
  const [open, setOpen] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease, delay }}
    >
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        className="flex w-full items-center gap-2.5 text-left group"
      >
        <Monitor className="h-4 w-4 shrink-0 text-muted" />
        <span className="flex-1 text-sm font-medium text-muted truncate">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted/50 transition-transform duration-200",
            open && "rotate-180"
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
            <ol className="mt-3 ml-6 flex flex-col gap-1.5 border-l border-panel-line/40 pl-4">
              {items.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 shrink-0">
                    {item.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : item.status === "running" ? (
                      <Loader2 className="h-4 w-4 text-accent animate-spin" />
                    ) : item.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <CircleDashed className="h-4 w-4 text-muted/40" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "leading-6",
                      item.status === "completed"
                        ? "text-muted line-through decoration-muted/30"
                        : item.status === "running"
                          ? "text-ink"
                          : "text-muted"
                    )}
                  >
                    {item.title}
                  </span>
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Streaming Text ────────────────────────────────────────────────── */

function StreamingText({
  text,
  charInterval = 18
}: {
  text: string;
  charInterval?: number;
}) {
  const [charCount, setCharCount] = useState(0);
  const frameRef = useRef(0);
  const startRef = useRef(0);

  useEffect(() => {
    setCharCount(0);
    startRef.current = 0;

    function step(timestamp: number) {
      if (!startRef.current) startRef.current = timestamp;
      const target = Math.min(
        Math.floor((timestamp - startRef.current) / charInterval),
        text.length
      );
      setCharCount(target);

      if (target < text.length) {
        frameRef.current = requestAnimationFrame(step);
      }
    }

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [text, charInterval]);

  const done = charCount >= text.length;

  return (
    <span>
      {text.slice(0, charCount)}
      {!done && (
        <span
          className="ml-0.5 inline-block h-[1.1em] w-[2px] bg-accent align-text-bottom"
          style={{ animation: "blink-cursor 1s step-end infinite" }}
        />
      )}
    </span>
  );
}

/* ── Subtask Output Card ───────────────────────────────────────────── */

/**
 * A streaming component that draws itself as SSE events arrive.
 *
 * Mount state: whatever data was present when the card first rendered.
 * Each piece that appears AFTER mount animates in — model badge fades,
 * file info slides, output text streams character by character.
 * The card is "drawn" by the AI as it works, not filled into a template.
 */
function SubtaskOutputCard({
  data,
  delay
}: {
  data: StepCardData;
  delay: number;
}) {
  const { step, latestLog, primaryArtifact, outputText } = data;
  const isRunning = step.status === "running" || step.status === "claimed";
  const isDone = step.status === "completed";
  const isFailed = step.status === "failed";

  /* ── Track what existed when this card mounted ──────────────── */
  const mountSnapshot = useRef({
    outputText,
    hadArtifact: !!primaryArtifact,
    hadModel: !!step.routeModelId,
    wasDone: isDone
  });

  /* Did outputText change after mount? If so, the new text is streaming in. */
  const textChangedAfterMount = outputText !== mountSnapshot.current.outputText;
  const shouldStreamText = textChangedAfterMount && isRunning;

  /* Did these elements appear after mount? If so, animate them in. */
  const artifactIsNew = !mountSnapshot.current.hadArtifact && !!primaryArtifact;
  const modelIsNew = !mountSnapshot.current.hadModel && !!step.routeModelId;
  const doneIsNew = !mountSnapshot.current.wasDone && isDone;

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
            : primaryArtifact.size > 0
              ? formatByteSize(primaryArtifact.size)
              : null
      }
    : null;

  /* ── Card status icon — evolves with the step ──────────────── */
  const statusIcon = isRunning ? (
    <Loader2 className="h-4 w-4 shrink-0 text-accent animate-spin" />
  ) : isDone ? (
    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
  ) : isFailed ? (
    <XCircle className="h-4 w-4 shrink-0 text-red-400" />
  ) : (
    <CircleDashed className="h-4 w-4 shrink-0 text-muted/40" />
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease, delay }}
      className={cn(
        "overflow-hidden rounded-2xl transition-shadow duration-300",
        isRunning
          ? "shadow-card-active"
          : isFailed
            ? "shadow-card-error"
            : "shadow-card hover:shadow-card-hover"
      )}
    >
      {/* ── Header — title + status icon + model badge + timestamp ── */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        {statusIcon}
        <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {step.title}
        </h4>

        {/* Model badge — materializes when routing resolves */}
        <AnimatePresence>
          {step.routeModelId && (
            <motion.div
              initial={modelIsNew ? { opacity: 0, scale: 0.92 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease }}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-panel-line/50 bg-surface-elevated px-2.5 py-1 text-[11px] font-medium text-muted"
            >
              <Sparkles className="h-3 w-3" />
              <span>{step.routeModelId}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timestamp — materializes when step completes */}
        <AnimatePresence>
          {isDone && (
            <motion.span
              initial={doneIsNew ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="shrink-0 text-[11px] tabular-nums text-muted/60"
            >
              {formatStepTimestamp(step)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Body — streams content as the AI works ─────────────── */}
      <div className="px-5 py-4 shadow-[inset_0_1px_0_var(--panel-line)]">
        {/* File info — materializes when artifact is created */}
        <AnimatePresence>
          {fileInfo && (
            <motion.p
              initial={artifactIsNew ? { opacity: 0, y: -4 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease }}
              className="mb-3 text-sm text-muted"
            >
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
            </motion.p>
          )}
        </AnimatePresence>

        {/* Content — phases: generating dots → streaming text → settled text */}
        <AnimatePresence mode="wait">
          {isRunning && !outputText && !latestLog ? (
            /* Phase 1: Generating — bouncing dots */
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 py-3 text-sm text-muted"
            >
              <span>Generating</span>
              <span className="flex gap-1">
                {[0, 200, 400].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-accent"
                    style={{
                      animation: `streaming-dot 1.2s ease-in-out infinite ${d}ms`
                    }}
                  />
                ))}
              </span>
            </motion.div>
          ) : outputText ? (
            /* Phase 2/3: Text content — streams when live, static when settled */
            <motion.div
              key="output"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {shouldStreamText ? (
                /* Running + text arrived via SSE → stream it character by character */
                <p className="text-sm leading-7 text-ink/80">
                  <StreamingText text={outputText} charInterval={14} />
                </p>
              ) : (
                /* Completed or initial render → show full text immediately */
                <div className="prose-feed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {outputText}
                  </ReactMarkdown>
                </div>
              )}
            </motion.div>
          ) : latestLog ? (
            /* Fallback: show latest log */
            <motion.div
              key="log"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-sm leading-7 text-muted">{latestLog.message}</p>
            </motion.div>
          ) : (
            /* No data yet */
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
            >
              <p className="text-sm italic text-muted/60">
                {step.status === "pending" || step.status === "ready"
                  ? "Waiting to start\u2026"
                  : "No output yet."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
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
  const [inFlightAction, setInFlightAction] = useState<
    "approve" | "reject" | null
  >(null);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "default" | "error";
    text: string;
  } | null>(null);

  async function submitResolution(action: "approve" | "reject") {
    setInFlightAction(action);
    setStatusMessage(null);
    try {
      const response = await fetch(
        `/api/approvals/${approval.id}/${action}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resolutionNote: null })
        }
      );
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
        text:
          error instanceof Error ? error.message : `Failed to ${action}.`
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
          style={{
            animation:
              "ping-slow 2s cubic-bezier(0,0,0.2,1) infinite"
          }}
        />
        <span>Approval required</span>
      </div>
      <h4 className="mt-2 text-sm font-semibold text-ink">
        {approval.title}
      </h4>
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
              <span>
                {displayWorkspacePath(artifact.relativePath)}
              </span>
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
          {inFlightAction === "approve"
            ? "Approving\u2026"
            : "Approve"}
        </button>
      </div>

      {statusMessage && (
        <p
          className={cn(
            "mt-3 text-sm",
            statusMessage.tone === "error"
              ? "text-red-500"
              : "text-muted"
          )}
        >
          {statusMessage.text}
        </p>
      )}
    </motion.div>
  );
}
