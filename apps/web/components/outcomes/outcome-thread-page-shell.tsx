"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type {
  Approval,
  AssistantMessageSnapshot,
  Artifact,
  MessageCreatedData,
  Outcome,
  OutcomeSource,
  Plan,
  RunDetail,
  RunLogData
} from "@computer-oss/protocol";
import { subscribeToOutcomeEvents } from "../../lib/events";
import { FollowUpInput } from "./follow-up-input";
import {
  OutcomeConversation,
  type OptimisticOutcomeMessage
} from "./outcome-conversation";
import { OutcomeTranscriptViewport } from "./outcome-transcript-viewport";

const ACTIVE_OUTCOME_STATUSES = new Set([
  "planning",
  "queued",
  "running",
  "blocked_on_approval"
]);

function isActiveOutcomeStatus(status?: string) {
  return status ? ACTIVE_OUTCOME_STATUSES.has(status) : false;
}

function isStaleOutcomeUpdate(current: Outcome, incoming: Outcome) {
  return incoming.updatedAt.localeCompare(current.updatedAt) < 0;
}

function matchesConfirmedOptimisticMessage(
  optimistic: OptimisticOutcomeMessage,
  confirmed: MessageCreatedData
) {
  if (confirmed.role !== optimistic.role || confirmed.content !== optimistic.content) {
    return false;
  }

  if (confirmed.outcomeId !== optimistic.outcomeId) {
    return false;
  }

  if (optimistic.knownMessageIdsAtSubmit.includes(confirmed.id)) {
    return false;
  }

  return true;
}

function reconcileOptimisticMessages(
  optimisticMessages: OptimisticOutcomeMessage[],
  confirmedMessages: MessageCreatedData[]
) {
  if (optimisticMessages.length === 0 || confirmedMessages.length === 0) {
    return optimisticMessages;
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

  if (matchedOptimisticIds.size === 0) {
    return optimisticMessages;
  }

  return optimisticMessages.filter(
    (optimistic) => !matchedOptimisticIds.has(optimistic.id)
  );
}

function createOptimisticMessageId() {
  return `optimistic:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

type OutcomeThreadPageShellProps = {
  outcome: Outcome;
  outcomeTitle: string;
  bootstrapState: string | null;
  conflictState: string | null;
  appendMessageAction: (formData: FormData) => Promise<void>;
  initialPlan: Plan | null;
  initialRun: RunDetail | null;
  initialThread: {
    isHydrated?: boolean;
    plans: Plan[];
    runs: RunDetail[];
  };
  initialArtifacts: Artifact[];
  initialLogs: RunLogData[];
  initialAssistantMessages: AssistantMessageSnapshot[];
  initialMessages: MessageCreatedData[];
  initialPendingApprovals: Approval[];
  outcomePrompt: string;
  outcomeSource: OutcomeSource;
};

export function OutcomeThreadPageShell({
  outcome,
  outcomeTitle,
  bootstrapState,
  conflictState,
  appendMessageAction,
  initialPlan,
  initialRun,
  initialThread,
  initialArtifacts,
  initialLogs,
  initialAssistantMessages,
  initialMessages,
  initialPendingApprovals,
  outcomePrompt,
  outcomeSource
}: OutcomeThreadPageShellProps) {
  const [liveOutcome, setLiveOutcome] = useState(outcome);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticOutcomeMessage[]>(
    []
  );
  const knownMessageIdsRef = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));

  useEffect(() => {
    setLiveOutcome(outcome);
  }, [outcome]);

  useEffect(() => {
    knownMessageIdsRef.current = new Set(initialMessages.map((message) => message.id));
    setOptimisticMessages((current) =>
      reconcileOptimisticMessages(current, initialMessages)
    );
  }, [initialMessages, outcome.id]);

  const appendOptimisticMessageAction = useCallback(
    async (formData: FormData) => {
      const content = String(formData.get("content") ?? "").trim();

      if (!content) {
        return appendMessageAction(formData);
      }

      const submittedAt = new Date().toISOString();

      const optimisticMessage: OptimisticOutcomeMessage = {
        id: createOptimisticMessageId(),
        outcomeId: outcome.id,
        role: "user",
        content,
        createdAt: submittedAt,
        submittedAt,
        knownMessageIdsAtSubmit: [...knownMessageIdsRef.current]
      };

      setOptimisticMessages((current) => [...current, optimisticMessage]);

      try {
        await appendMessageAction(formData);
      } catch (error) {
        setOptimisticMessages((current) =>
          current.filter((message) => message.id !== optimisticMessage.id)
        );
        throw error;
      }
    },
    [appendMessageAction, outcome.id]
  );

  useEffect(() => {
    return subscribeToOutcomeEvents(outcome.id, (event) => {
      startTransition(() => {
        if (event.type === "outcome.updated" && event.data.id === outcome.id) {
          setLiveOutcome((current) =>
            isStaleOutcomeUpdate(current, event.data) ? current : event.data
          );
          return;
        }

        if (event.type === "message.created" && event.data.outcomeId === outcome.id) {
          knownMessageIdsRef.current.add(event.data.id);

          if (event.data.role === "user") {
            setOptimisticMessages((current) =>
              reconcileOptimisticMessages(current, [event.data])
            );
          }
        }
      });
    });
  }, [outcome.id]);

  const hasConversation =
    initialMessages.length > 0 ||
    initialAssistantMessages.length > 0 ||
    initialThread.runs.length > 0 ||
    initialArtifacts.length > 0;

  return (
    <>
      <header className="sticky top-0 shrink-0 flex items-center justify-between gap-4 border-b border-panel-line/50 bg-shell/80 px-6 py-3 backdrop-blur-xl z-20">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <h2 className="truncate text-sm font-semibold text-ink [text-wrap:balance]">
            {outcomeTitle}
          </h2>
          {(liveOutcome.status === "running" || liveOutcome.status === "planning") && (
            <span
              data-testid="outcome-status-pulse"
              className="relative flex h-1.5 w-1.5 shrink-0"
            >
              <span
                className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-accent opacity-75"
                style={{ animation: "ping-slow 2s cubic-bezier(0,0,0.2,1) infinite" }}
              />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            data-testid="outcome-status-pill"
            className="rounded-full border border-panel-line/70 bg-surface-elevated/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted"
          >
            {liveOutcome.status}
          </span>
          {initialRun ? (
            <span className="rounded-full border border-panel-line/70 bg-surface-elevated/70 px-3 py-1 text-[11px] font-semibold text-muted">
              {initialRun.steps.length} {initialRun.steps.length === 1 ? "step" : "steps"}
            </span>
          ) : null}
        </div>
      </header>

      <OutcomeTranscriptViewport
        composer={
          <FollowUpInput
            action={appendOptimisticMessageAction}
            hasConversation={hasConversation}
            disabled={isActiveOutcomeStatus(liveOutcome.status)}
          />
        }
      >
        {bootstrapState === "plan" ? (
          <p className="rounded-xl border border-amber-300/40 bg-amber-50/40 px-4 py-3 text-sm text-amber-800">
            Automatic plan generation failed before execution began.
          </p>
        ) : null}

        {bootstrapState === "run" ? (
          <p className="rounded-xl border border-amber-300/40 bg-amber-50/40 px-4 py-3 text-sm text-amber-800">
            Automatic run start failed before execution began.
          </p>
        ) : null}

        {conflictState === "active-run" ? (
          <p className="rounded-xl border border-amber-300/40 bg-amber-50/40 px-4 py-3 text-sm text-amber-800">
            Mycelium is still working on the current run. Wait for it to finish before
            sending a follow-up.
          </p>
        ) : null}

        <OutcomeConversation
          outcomeId={outcome.id}
          outcomePrompt={outcomePrompt}
          outcomeSource={outcomeSource}
          initialPlan={initialPlan}
          initialRun={initialRun}
          initialThread={initialThread}
          initialArtifacts={initialArtifacts}
          initialLogs={initialLogs}
          initialAssistantMessages={initialAssistantMessages}
          initialMessages={initialMessages}
          optimisticMessages={optimisticMessages}
          initialPendingApprovals={initialPendingApprovals}
        />
      </OutcomeTranscriptViewport>
    </>
  );
}
