"use client";

import {
  type Dispatch,
  Fragment,
  memo,
  startTransition,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type {
  Approval,
  AssistantMessageSnapshot,
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
import {
  type ActionGroupItemData,
  appendLog,
  appendAssistantMessageDelta,
  appendMessage,
  buildInitialOutcomeConversationState,
  buildOutcomeThreadTurns,
  completeAssistantMessage,
  displayWorkspacePath,
  formatByteSize,
  type OutcomeConversationState,
  type OutcomeFeedItem,
  type OutcomeThreadTurn,
  startAssistantMessage,
  type StepCardData,
  sortSteps,
  upsertArtifact,
  upsertStep
} from "./outcome-feed";
import { BlockRenderer } from "./block-renderer";

/* ── Types ──────────────────────────────────────────────────────────── */

type OutcomeConversationProps = {
  outcomeId: string;
  outcomePrompt: string;
  outcomeSource: OutcomeSource;
  initialPlan: Plan | null;
  initialRun: RunDetail | null;
  initialThread?: {
    isHydrated?: boolean;
    plans: Plan[];
    runs: RunDetail[];
  };
  initialArtifacts: Artifact[];
  initialLogs: RunLogData[];
  initialAssistantMessages: AssistantMessageSnapshot[];
  initialMessages: MessageCreatedData[];
  optimisticMessages?: OptimisticOutcomeMessage[];
  initialPendingApprovals: Approval[];
};

export type OptimisticOutcomeMessage = MessageCreatedData & {
  submissionId: string;
};

type OutcomeConversationViewState = {
  conversation: OutcomeConversationState;
};

type OutcomeThreadState = NonNullable<OutcomeConversationState["thread"]>;
type RunEventSnapshot = Omit<RunDetail, "steps"> & Partial<Pick<RunDetail, "steps">>;

function seedThreadState(
  conversation: OutcomeConversationState
): OutcomeThreadState {
  return {
    isHydrated: conversation.thread?.isHydrated ?? false,
    plans: conversation.thread?.plans ?? (conversation.plan ? [conversation.plan] : []),
    runs: conversation.thread?.runs ?? (conversation.run ? [conversation.run] : [])
  };
}

function mergeAssistantMessages(
  current: AssistantMessageSnapshot[],
  incoming: AssistantMessageSnapshot[]
) {
  const next = [...current];

  for (const message of incoming) {
    const index = next.findIndex((entry) => entry.id === message.id);

    if (index >= 0) {
      next[index] = message;
      continue;
    }

    next.push(message);
  }

  return [...next].sort((left, right) => {
    const createdDelta = left.createdAt.localeCompare(right.createdAt);

    if (createdDelta !== 0) {
      return createdDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function mergePendingApprovals(
  current: Approval[],
  incoming: Approval[],
  options?: {
    authoritativeHydration?: boolean;
    preserveLiveApprovalIds?: ReadonlySet<string>;
  }
) {
  const authoritativeHydration = options?.authoritativeHydration ?? false;

  if (authoritativeHydration) {
    const incomingIds = new Set(incoming.map((approval) => approval.id));
    const preservedApprovals = current.filter(
      (approval) =>
        !incomingIds.has(approval.id) &&
        (options?.preserveLiveApprovalIds?.has(approval.id) ?? false)
    );

    return [...incoming, ...preservedApprovals].sort((left, right) =>
      left.requestedAt.localeCompare(right.requestedAt)
    );
  }

  const next = [...current];

  for (const approval of incoming) {
    const index = next.findIndex((entry) => entry.id === approval.id);

    if (index >= 0) {
      next[index] = approval;
      continue;
    }

    next.push(approval);
  }

  return [...next].sort((left, right) => left.requestedAt.localeCompare(right.requestedAt));
}

function mergeThreadPlans(current: Plan[], incoming: Plan[]) {
  const next = [...current];

  for (const plan of incoming) {
    const index = next.findIndex((entry) => entry.id === plan.id);

    if (index >= 0) {
      next[index] = plan;
      continue;
    }

    next.push(plan);
  }

  return [...next].sort((left, right) => {
    const createdDelta = left.createdAt.localeCompare(right.createdAt);

    if (createdDelta !== 0) {
      return createdDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function mergeThreadRuns(current: RunDetail[], incoming: RunDetail[]) {
  const next = [...current];

  for (const run of incoming) {
    const index = next.findIndex((entry) => entry.id === run.id);

    if (index >= 0) {
      next[index] = {
        ...run,
        steps: sortSteps(run.steps)
      };
      continue;
    }

    next.push({
      ...run,
      steps: sortSteps(run.steps)
    });
  }

  return [...next].sort((left, right) => {
    const createdDelta = left.createdAt.localeCompare(right.createdAt);

    if (createdDelta !== 0) {
      return createdDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function toRunDetail(incoming: RunEventSnapshot, fallbackSteps: RunStep[] = []): RunDetail {
  return {
    ...incoming,
    steps: sortSteps(Array.isArray(incoming.steps) ? incoming.steps : fallbackSteps)
  };
}

function upsertLiveRun(current: RunDetail[], incoming: RunEventSnapshot) {
  const next = [...current];
  const index = next.findIndex((entry) => entry.id === incoming.id);

  const mergedRun =
    index >= 0
      ? toRunDetail(incoming, next[index]?.steps ?? [])
      : toRunDetail(incoming);

  if (index >= 0) {
    next[index] = mergedRun;
  } else {
    next.push(mergedRun);
  }

  return mergeThreadRuns([], next);
}

function upsertRunStepInThread(current: RunDetail[], incoming: RunStep) {
  return current.map((run) =>
    run.id === incoming.runId
      ? {
          ...run,
          steps: upsertStep(run.steps, incoming)
        }
      : run
  );
}

function mergeConversationState(
  current: OutcomeConversationState,
  incoming: OutcomeConversationState,
  options?: {
    preserveLiveApprovalIds?: ReadonlySet<string>;
  }
): OutcomeConversationState {
  const hasThread = Boolean(
    current.thread ||
      incoming.thread ||
      (current.plan && incoming.plan && current.plan.id !== incoming.plan.id) ||
      (current.run && incoming.run && current.run.id !== incoming.run.id)
  );

  return {
    plan: incoming.plan ?? current.plan,
    run: incoming.run ?? current.run,
    artifacts: incoming.artifacts.reduce(upsertArtifact, current.artifacts),
    logs: incoming.logs.reduce(appendLog, current.logs),
    pendingApprovals: mergePendingApprovals(
      current.pendingApprovals,
      incoming.pendingApprovals,
      {
        authoritativeHydration: incoming.thread?.isHydrated ?? false,
        preserveLiveApprovalIds: options?.preserveLiveApprovalIds
      }
    ),
    messages: incoming.messages.reduce(appendMessage, current.messages),
    assistantMessages: mergeAssistantMessages(
      current.assistantMessages,
      incoming.assistantMessages
    ),
    ...(hasThread
      ? {
          thread: {
            isHydrated:
              current.thread?.isHydrated ?? incoming.thread?.isHydrated ?? false,
            plans: mergeThreadPlans(
              current.thread?.plans ?? (current.plan ? [current.plan] : []),
              incoming.thread?.plans ?? (incoming.plan ? [incoming.plan] : [])
            ),
            runs: mergeThreadRuns(
              current.thread?.runs ?? (current.run ? [current.run] : []),
              incoming.thread?.runs ?? (incoming.run ? [incoming.run] : [])
            )
          }
        }
      : {})
  };
}

function buildInitialViewState(
  initialPlan: Plan | null,
  initialRun: RunDetail | null,
  initialThread:
    | {
        isHydrated?: boolean;
        plans: Plan[];
        runs: RunDetail[];
      }
    | undefined,
  initialArtifacts: Artifact[],
  initialLogs: RunLogData[],
  initialAssistantMessages: AssistantMessageSnapshot[],
  initialMessages: MessageCreatedData[],
  initialPendingApprovals: Approval[]
): OutcomeConversationViewState {
  const conversation = buildInitialOutcomeConversationState(
    initialPlan,
    initialRun,
    initialArtifacts,
    initialLogs,
    initialAssistantMessages,
    initialMessages,
    initialPendingApprovals
  );

  return {
    conversation: {
      ...conversation,
      ...(initialThread ? { thread: initialThread } : {})
    }
  };
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

/* ── Easing ─────────────────────────────────────────────────────────── */

const ease = [0.25, 1, 0.5, 1] as const;

type OutcomeThreadRenderEntry = {
  turn: OutcomeThreadTurn;
  startIndex: number;
};

function buildThreadRenderEntries(
  turns: OutcomeThreadTurn[]
): OutcomeThreadRenderEntry[] {
  let startIndex = 0;

  return turns.map((turn) => {
    const entry = {
      turn,
      startIndex
    };

    startIndex += turn.items.length;

    return entry;
  });
}

function sortRenderableMessages(messages: MessageCreatedData[]) {
  return [...messages].sort((left, right) => {
    const createdDelta = left.createdAt.localeCompare(right.createdAt);

    if (createdDelta !== 0) {
      return createdDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function matchesConfirmedOptimisticMessage(
  optimistic: OptimisticOutcomeMessage,
  confirmed: MessageCreatedData
) {
  return (
    confirmed.outcomeId === optimistic.outcomeId &&
    confirmed.role === optimistic.role &&
    confirmed.submissionId !== null &&
    confirmed.submissionId === optimistic.submissionId
  );
}

function mergeRenderableOutcomeMessages(
  confirmedMessages: MessageCreatedData[],
  optimisticMessages: OptimisticOutcomeMessage[]
) {
  if (optimisticMessages.length === 0) {
    return confirmedMessages;
  }

  const matchedOptimisticIds = new Set<string>();

  for (const confirmed of confirmedMessages) {
    const nextMatch = optimisticMessages.find(
      (optimistic) =>
        !matchedOptimisticIds.has(optimistic.id) &&
        matchesConfirmedOptimisticMessage(optimistic, confirmed)
    );

    if (nextMatch) {
      matchedOptimisticIds.add(nextMatch.id);
    }
  }

  const unresolvedOptimisticMessages =
    matchedOptimisticIds.size === 0
      ? optimisticMessages
      : optimisticMessages.filter(
          (optimistic) => !matchedOptimisticIds.has(optimistic.id)
        );

  if (unresolvedOptimisticMessages.length === 0) {
    return confirmedMessages;
  }

  return sortRenderableMessages([...confirmedMessages, ...unresolvedOptimisticMessages]);
}

/* ── Main component ─────────────────────────────────────────────────── */

export function OutcomeConversation({
  outcomeId,
  outcomePrompt,
  outcomeSource,
  initialPlan,
  initialRun,
  initialThread,
  initialArtifacts,
  initialLogs,
  initialAssistantMessages,
  initialMessages,
  optimisticMessages = [],
  initialPendingApprovals
}: OutcomeConversationProps) {
  const [viewState, setViewState] = useState<OutcomeConversationViewState>(() =>
    buildInitialViewState(
      initialPlan,
      initialRun,
      initialThread,
      initialArtifacts,
      initialLogs,
      initialAssistantMessages,
      initialMessages,
      initialPendingApprovals
    )
  );
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const previousOutcomeIdRef = useRef(outcomeId);
  const previousTurnsOutcomeIdRef = useRef(outcomeId);
  const previousTurnsRef = useRef<OutcomeThreadTurn[] | undefined>(undefined);
  const livePendingApprovalIdsRef = useRef<Set<string>>(new Set());

  /* Keys present at first render — anything NOT in this set arrived via SSE */
  const mountKeysRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    mountKeysRef.current = null;
    const nextState = buildInitialViewState(
      initialPlan,
      initialRun,
      initialThread,
      initialArtifacts,
      initialLogs,
      initialAssistantMessages,
      initialMessages,
      initialPendingApprovals
    );

    setViewState((current) => {
      if (previousOutcomeIdRef.current !== outcomeId) {
        previousOutcomeIdRef.current = outcomeId;
        livePendingApprovalIdsRef.current = new Set();
        return nextState;
      }

      if (nextState.conversation.thread?.isHydrated) {
        for (const approval of nextState.conversation.pendingApprovals) {
          livePendingApprovalIdsRef.current.delete(approval.id);
        }
      }

      return {
        conversation: mergeConversationState(
          current.conversation,
          nextState.conversation,
          {
            preserveLiveApprovalIds: livePendingApprovalIdsRef.current
          }
        )
      };
    });
  }, [
    outcomeId,
    initialPlan,
    initialRun,
    initialThread,
    initialArtifacts,
    initialLogs,
    initialAssistantMessages,
    initialMessages,
    initialPendingApprovals
  ]);

  useEffect(() => {
    return subscribeToOutcomeEvents(outcomeId, (event) => {
      startTransition(() => {
        setViewState((current) => {
          const conversation = current.conversation;

          switch (event.type) {
            case "plan.created":
              {
                const thread = seedThreadState(conversation);

                return {
                  conversation: {
                    ...conversation,
                    plan: event.data,
                    thread: {
                      isHydrated: thread.isHydrated,
                      plans: mergeThreadPlans(thread.plans, [event.data]),
                      runs: thread.runs
                    }
                  }
                };
              }
            case "assistant.message.started":
              return {
                conversation: {
                  ...conversation,
                  assistantMessages: startAssistantMessage(
                    conversation.assistantMessages,
                    event.data
                  )
                }
              };
            case "assistant.message.delta":
              return {
                conversation: {
                  ...conversation,
                  assistantMessages: appendAssistantMessageDelta(
                    conversation.assistantMessages,
                    event.data
                  )
                }
              };
            case "assistant.message.completed":
              return {
                conversation: {
                  ...conversation,
                  assistantMessages: completeAssistantMessage(
                    conversation.assistantMessages,
                    event.data
                  )
                }
              };
            case "run.created":
              {
                const thread = seedThreadState(conversation);

                return {
                  conversation: {
                    ...conversation,
                    run: toRunDetail(
                      event.data,
                      conversation.run?.id === event.data.id
                        ? conversation.run.steps
                        : []
                    ),
                    thread: {
                      isHydrated: thread.isHydrated,
                      plans: thread.plans,
                      runs: upsertLiveRun(thread.runs, event.data)
                    }
                  }
                };
              }
            case "run.updated":
              {
                const thread = seedThreadState(conversation);

                return {
                  conversation: {
                    ...conversation,
                    run:
                      conversation.run?.id === event.data.id
                        ? toRunDetail(event.data, conversation.run.steps)
                        : conversation.run,
                    thread: {
                      isHydrated: thread.isHydrated,
                      plans: thread.plans,
                      runs: upsertLiveRun(thread.runs, event.data)
                    }
                  }
                };
              }
            case "run.step.updated":
              {
                const thread = seedThreadState(conversation);

                return {
                  conversation: {
                    ...conversation,
                    run:
                      conversation.run?.id === event.data.runId
                        ? {
                            ...conversation.run,
                            steps: upsertStep(conversation.run.steps, event.data)
                          }
                        : conversation.run,
                    thread: {
                      isHydrated: thread.isHydrated,
                      plans: thread.plans,
                      runs: upsertRunStepInThread(thread.runs, event.data)
                    }
                  }
                };
              }
            case "run.log":
              return {
                conversation: {
                  ...conversation,
                  logs: appendLog(conversation.logs, event.data)
                }
              };
            case "artifact.created":
              return {
                conversation: {
                  ...conversation,
                  artifacts: upsertArtifact(conversation.artifacts, event.data)
                }
              };
            case "approval.requested":
              livePendingApprovalIdsRef.current.add(event.data.id);
              return {
                conversation: {
                  ...conversation,
                  pendingApprovals: conversation.pendingApprovals.some(
                    (a) => a.id === event.data.id
                  )
                    ? conversation.pendingApprovals.map((a) =>
                        a.id === event.data.id ? event.data : a
                      )
                    : [...conversation.pendingApprovals, event.data]
                }
              };
            case "approval.resolved":
              livePendingApprovalIdsRef.current.delete(event.data.id);
              return {
                conversation: {
                  ...conversation,
                  pendingApprovals: conversation.pendingApprovals.filter(
                    (a) => a.id !== event.data.id
                  )
                }
              };
            case "message.created":
              return {
                conversation: {
                  ...conversation,
                  messages: appendMessage(conversation.messages, event.data)
                }
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

  const state = viewState.conversation;
  const renderableMessages = useMemo(
    () => mergeRenderableOutcomeMessages(state.messages, optimisticMessages),
    [optimisticMessages, state.messages]
  );
  const renderState = useMemo(
    () => ({
      ...state,
      messages: renderableMessages
    }),
    [renderableMessages, state]
  );
  const threadTurns = useMemo(() => {
    return buildOutcomeThreadTurns({
      outcomePrompt,
      outcomeSource,
      state: renderState,
      previousTurns:
        previousTurnsOutcomeIdRef.current === outcomeId
          ? previousTurnsRef.current
          : undefined
    });
  }, [outcomePrompt, outcomeSource, outcomeId, renderState]);
  const threadRenderEntries = useMemo(
    () => buildThreadRenderEntries(threadTurns),
    [threadTurns]
  );

  useEffect(() => {
    previousTurnsOutcomeIdRef.current = outcomeId;
    previousTurnsRef.current = threadTurns;
  }, [outcomeId, threadTurns]);

  /* Snapshot on first render */
  if (mountKeysRef.current === null) {
    mountKeysRef.current = new Set(
      threadTurns.flatMap((turn) => turn.items.map((item) => item.key))
    );
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-6">
      {threadRenderEntries.map((entry) => (
        <OutcomeThreadTurnBlock
          key={entry.turn.key}
          turn={entry.turn}
          startIndex={entry.startIndex}
          mountKeysRef={mountKeysRef}
          outcomePrompt={outcomePrompt}
          promptPreview={promptPreview}
          showFullPrompt={showFullPrompt}
          setShowFullPrompt={setShowFullPrompt}
        />
      ))}
    </div>
  );
}

type OutcomeThreadTurnBlockProps = {
  turn: OutcomeThreadTurn;
  startIndex: number;
  mountKeysRef: MutableRefObject<Set<string> | null>;
  outcomePrompt: string;
  promptPreview: string;
  showFullPrompt: boolean;
  setShowFullPrompt: Dispatch<SetStateAction<boolean>>;
};

const OutcomeThreadTurnBlock = memo(function OutcomeThreadTurnBlock({
  turn,
  startIndex,
  mountKeysRef,
  outcomePrompt,
  promptPreview,
  showFullPrompt,
  setShowFullPrompt
}: OutcomeThreadTurnBlockProps) {
  const isTurnLive =
    turn.latestRunStatus !== null &&
    ["running", "queued", "blocked"].includes(turn.latestRunStatus);

  return (
    <Fragment>
      {turn.items.map((item, index) => {
        const isFromSSE = !(mountKeysRef.current?.has(item.key) ?? true);
        const delay = isFromSSE
          ? 0
          : Math.min((startIndex + index) * 0.06, 0.5);

        return (
          <BlockRenderer
            key={item.key}
            item={item}
            delay={delay}
            ease={ease}
            isFromSSE={isFromSSE}
            isTurnLive={isTurnLive}
            outcomePrompt={outcomePrompt}
            promptPreview={promptPreview}
            showFullPrompt={showFullPrompt}
            setShowFullPrompt={setShowFullPrompt}
            renderIntentText={(message) => <StreamingText text={message} />}
            renderPlan={(planItem) => (
              <ActionGroup
                key={planItem.key}
                title={planItem.title}
                items={planItem.items}
                delay={delay}
              />
            )}
            renderTask={(taskItem) => (
              <SubtaskOutputCard
                key={taskItem.key}
                data={taskItem.data}
                delay={delay}
              />
            )}
            renderArtifactDelivery={(artifactItem) => (
              <ArtifactDeliveryCard
                key={artifactItem.key}
                title={artifactItem.title}
                workspacePath={artifactItem.workspacePath}
                artifact={artifactItem.artifact}
                step={artifactItem.step}
                delay={delay}
              />
            )}
            renderApproval={(approvalItem) => (
              <InlineApprovalCard
                key={approvalItem.key}
                approval={approvalItem.approval}
                artifacts={approvalItem.artifacts}
              />
            )}
          />
        );
      })}
    </Fragment>
  );
},
function areEqualOutcomeThreadTurnBlockProps(
  previous,
  next
) {
  if (previous.turn !== next.turn || previous.startIndex !== next.startIndex) {
    return false;
  }

  if (next.turn.promptItem) {
    return (
      previous.outcomePrompt === next.outcomePrompt &&
      previous.promptPreview === next.promptPreview &&
      previous.showFullPrompt === next.showFullPrompt
    );
  }

  return true;
});

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
        <span className="flex-1 truncate text-sm font-medium text-muted">
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

export function StreamingText({
  text,
  charInterval = 18
}: {
  text: string;
  charInterval?: number;
}) {
  const [charCount, setCharCount] = useState(0);
  const frameRef = useRef(0);
  const progressRef = useRef(0);
  const lastTimestampRef = useRef<number | null>(null);
  const previousTextRef = useRef("");
  const charCountRef = useRef(0);
  charCountRef.current = charCount;

  useEffect(() => {
    const previousText = previousTextRef.current;
    const isAppendedText =
      text.length >= previousText.length && text.startsWith(previousText);

    if (isAppendedText) {
      const currentCharCount = charCountRef.current;
      const cappedCount = Math.min(currentCharCount, text.length);

      progressRef.current = cappedCount;
      charCountRef.current = cappedCount;

      if (cappedCount !== currentCharCount) {
        setCharCount(cappedCount);
      }
    } else {
      progressRef.current = 0;
      charCountRef.current = 0;
      setCharCount(0);
    }

    previousTextRef.current = text;
    lastTimestampRef.current = null;
    cancelAnimationFrame(frameRef.current);

    function step(timestamp: number) {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      } else {
        progressRef.current = Math.min(
          progressRef.current + (timestamp - lastTimestampRef.current) / charInterval,
          text.length
        );
        lastTimestampRef.current = timestamp;
      }

      const target = Math.min(Math.floor(progressRef.current), text.length);

      if (target !== charCountRef.current) {
        charCountRef.current = target;
        setCharCount(target);
      }

      if (target < text.length) {
        frameRef.current = requestAnimationFrame(step);
      }
    }

    if (charCountRef.current < text.length) {
      frameRef.current = requestAnimationFrame(step);
    }

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
  const promotesResultDelivery = isDone && primaryArtifact?.kind === "result";

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

  const fileInfo = primaryArtifact && !promotesResultDelivery
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
      <div className="flex items-center gap-3 px-5 py-3.5">
        {statusIcon}
        <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {step.title}
        </h4>

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

      <div className="px-5 py-4 shadow-[inset_0_1px_0_var(--panel-line)]">
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

        <AnimatePresence mode="wait">
          {promotesResultDelivery ? (
            <motion.div
              key="delivery-handoff"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-sm leading-7 text-muted">
                Final artifact packaged. The delivery block below carries the
                file path and summary.
              </p>
            </motion.div>
          ) : isRunning && !outputText && !latestLog ? (
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
            <motion.div
              key="output"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {shouldStreamText ? (
                <p className="text-sm leading-7 text-ink/80">
                  <StreamingText text={outputText} charInterval={14} />
                </p>
              ) : (
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

/* ── Artifact Delivery Card ───────────────────────────────────────── */

function ArtifactDeliveryCard({
  title,
  workspacePath,
  artifact,
  step,
  delay
}: {
  title: string;
  workspacePath: string;
  artifact: Artifact;
  step: RunStep | null;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.35, ease, delay }}
      className="rounded-2xl border border-emerald-200/60 bg-emerald-50/60 p-5 shadow-[0_12px_35px_-24px_rgba(22,163,74,0.55)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700/80">
            Delivered artifact
          </p>
          <h4 className="text-sm font-semibold text-ink">{title}</h4>
          {step ? (
            <p className="text-sm leading-6 text-muted">
              Generated by <span className="font-medium text-ink">{step.title}</span>.
            </p>
          ) : null}
        </div>

        <div className="rounded-full border border-emerald-300/60 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
          {artifact.kind}
        </div>
      </div>

      <div className="mt-4 rounded-[1.25rem] border border-emerald-200/70 bg-white/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Workspace output
        </p>
        <code className="mt-2 block text-sm text-emerald-700">{workspacePath}</code>
        <p className="mt-2 text-xs text-muted">
          {formatByteSize(artifact.size)}
        </p>
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
