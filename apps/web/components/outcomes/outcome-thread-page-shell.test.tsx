import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutcomeThreadPageShell } from "./outcome-thread-page-shell";

const eventStream = vi.hoisted(() => ({
  handlers: new Set<(event: any) => void>()
}));

let observedFollowUpAction: ((formData: FormData) => Promise<void>) | null = null;
let observedConversationMessages: Array<{ id: string; content: string }> = [];
let observedOptimisticMessages: Array<{
  id: string;
  content: string;
  submissionId?: string | null;
}> = [];
let observedHasConversation = false;

vi.mock("../../lib/events", () => ({
  subscribeToOutcomeEvents: (
    _outcomeId: string,
    handler: (event: unknown) => void
  ) => {
    const typedHandler = handler as (event: any) => void;
    eventStream.handlers.add(typedHandler);

    return () => {
      eventStream.handlers.delete(typedHandler);
    };
  }
}));

vi.mock("./outcome-conversation", () => ({
  OutcomeConversation: ({
    initialMessages,
    optimisticMessages = []
  }: {
    initialMessages: Array<{ id: string; content: string }>;
    optimisticMessages?: Array<{ id: string; content: string }>;
  }) => {
    observedConversationMessages = initialMessages;
    observedOptimisticMessages = optimisticMessages;

    return (
      <div data-testid="outcome-conversation">
        {[...initialMessages, ...optimisticMessages].map((message) => (
          <p key={message.id}>{message.content}</p>
        ))}
      </div>
    );
  }
}));

vi.mock("./follow-up-input", () => ({
  FollowUpInput: ({
    action,
    initialSubmissionId,
    disabled,
    hasConversation
  }: {
    action: (formData: FormData) => Promise<void>;
    initialSubmissionId: string;
    disabled?: boolean;
    hasConversation?: boolean;
  }) => {
    observedFollowUpAction = action;
    observedHasConversation = Boolean(hasConversation);

    return (
      <div>
        <input type="hidden" value={initialSubmissionId} readOnly />
        <textarea placeholder="Type a command..." disabled={disabled} />
        {hasConversation ? <span data-testid="follow-up-feedback-row" /> : null}
      </div>
    );
  }
}));

vi.mock("./outcome-transcript-viewport", () => ({
  OutcomeTranscriptViewport: ({
    children,
    composer
  }: {
    children: React.ReactNode;
    composer?: React.ReactNode;
  }) => (
    <div data-testid="outcome-transcript-viewport">
      <div data-testid="outcome-transcript-content">{children}</div>
      <div data-testid="outcome-transcript-overlay">{composer}</div>
    </div>
  )
}));

function buildProps() {
  return {
    outcome: {
      id: "outcome_123",
      workspaceId: "ws_default",
      userId: "user_default",
      prompt: "Research the state of AI in schools.",
      source: "web" as const,
      status: "running" as const,
      createdAt: "2026-03-25T10:00:00.000Z",
      updatedAt: "2026-03-25T10:00:00.000Z"
    },
    outcomeTitle: "AI in Schools",
    initialSubmissionId: "submit_initial",
    bootstrapState: null,
    conflictState: null,
    appendMessageAction: vi.fn(async () => undefined),
    initialPlan: null,
    initialRun: {
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_123",
      triggerMessageId: "msg_123",
      status: "running" as const,
      createdAt: "2026-03-25T10:00:01.000Z",
      updatedAt: "2026-03-25T10:00:02.000Z",
      steps: []
    },
    initialThread: {
      isHydrated: true,
      plans: [],
      runs: []
    },
    initialArtifacts: [],
    initialLogs: [],
    initialAssistantMessages: [],
    initialMessages: [],
    initialPendingApprovals: [],
    outcomePrompt: "Research the state of AI in schools.",
    outcomeSource: "web" as const
  };
}

describe("OutcomeThreadPageShell", () => {
  beforeEach(() => {
    eventStream.handlers.clear();
    observedFollowUpAction = null;
    observedConversationMessages = [];
    observedOptimisticMessages = [];
    observedHasConversation = false;
  });

  afterEach(() => {
    cleanup();
    eventStream.handlers.clear();
    observedFollowUpAction = null;
    observedConversationMessages = [];
    observedOptimisticMessages = [];
    observedHasConversation = false;
  });

  it("re-enables the follow-up composer and updates the header when the live outcome completes", () => {
    render(<OutcomeThreadPageShell {...buildProps()} />);

    expect(screen.getByTestId("outcome-status-pill")).toHaveTextContent("running");
    expect(screen.getByTestId("outcome-status-pulse")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a command...")).toBeDisabled();

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "outcome.updated",
          data: {
            id: "outcome_123",
            workspaceId: "ws_default",
            userId: "user_default",
            prompt: "Research the state of AI in schools.",
            source: "web",
            status: "completed",
            createdAt: "2026-03-25T10:00:00.000Z",
            updatedAt: "2026-03-25T10:05:00.000Z"
          }
        });
      }
    });

    expect(screen.getByTestId("outcome-status-pill")).toHaveTextContent("completed");
    expect(screen.queryByTestId("outcome-status-pulse")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a command...")).not.toBeDisabled();
  });

  it("clears the active-run conflict banner once live outcome status is no longer active", () => {
    render(
      <OutcomeThreadPageShell
        {...buildProps()}
        conflictState="active-run"
      />
    );

    expect(
      screen.getByText(/Mycelium is still working on the current run/i)
    ).toBeInTheDocument();

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "outcome.updated",
          data: {
            ...buildProps().outcome,
            status: "completed",
            updatedAt: "2026-03-25T10:05:00.000Z"
          }
        });
      }
    });

    expect(
      screen.queryByText(/Mycelium is still working on the current run/i)
    ).not.toBeInTheDocument();
  });

  it("treats queued and blocked outcomes as active shell states", () => {
    const props = buildProps();
    const { rerender } = render(
      <OutcomeThreadPageShell
        {...props}
        outcome={{
          ...props.outcome,
          status: "queued"
        }}
      />
    );

    expect(screen.getByTestId("outcome-status-pill")).toHaveTextContent("queued");
    expect(screen.getByTestId("outcome-status-pulse")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a command...")).toBeDisabled();

    rerender(
      <OutcomeThreadPageShell
        {...props}
        outcome={{
          ...props.outcome,
          status: "blocked_on_approval"
        }}
      />
    );

    expect(screen.getByTestId("outcome-status-pill")).toHaveTextContent(
      "blocked_on_approval"
    );
    expect(screen.getByTestId("outcome-status-pulse")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a command...")).toBeDisabled();
  });

  it("turns on composer-adjacent conversation controls when live thread activity begins", () => {
    render(
      <OutcomeThreadPageShell
        {...buildProps()}
        initialRun={null}
        initialThread={{
          isHydrated: true,
          plans: [],
          runs: []
        }}
        initialAssistantMessages={[]}
        initialMessages={[]}
        initialArtifacts={[]}
      />
    );

    expect(observedHasConversation).toBe(false);
    expect(screen.queryByTestId("follow-up-feedback-row")).not.toBeInTheDocument();

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "assistant.message.started",
          data: {
            messageId: "assistant_1",
            runId: "run_123",
            kind: "acknowledgment",
            createdAt: "2026-03-25T10:01:00.000Z"
          }
        });
      }
    });

    expect(observedHasConversation).toBe(true);
    expect(screen.getByTestId("follow-up-feedback-row")).toBeInTheDocument();
  });

  it("disables the composer again when a later outcome.updated event returns to an active state", () => {
    const props = buildProps();

    render(
      <OutcomeThreadPageShell
        {...props}
        outcome={{
          ...props.outcome,
          status: "completed"
        }}
      />
    );

    expect(screen.getByPlaceholderText("Type a command...")).not.toBeDisabled();
    expect(screen.queryByTestId("outcome-status-pulse")).not.toBeInTheDocument();

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "outcome.updated",
          data: {
            ...props.outcome,
            status: "running",
            updatedAt: "2026-03-25T10:06:00.000Z"
          }
        });
      }
    });

    expect(screen.getByTestId("outcome-status-pill")).toHaveTextContent("running");
    expect(screen.getByTestId("outcome-status-pulse")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a command...")).toBeDisabled();
  });

  it("ignores stale outcome.updated events that are older than the current shell state", () => {
    const props = buildProps();

    const { rerender } = render(
      <OutcomeThreadPageShell
        {...props}
        outcome={{
          ...props.outcome,
          status: "completed",
          updatedAt: "2026-03-25T10:10:00.000Z"
        }}
      />
    );

    rerender(
      <OutcomeThreadPageShell
        {...props}
        outcome={{
          ...props.outcome,
          status: "completed",
          updatedAt: "2026-03-25T10:10:00.000Z"
        }}
      />
    );

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "outcome.updated",
          data: {
            ...props.outcome,
            status: "running",
            updatedAt: "2026-03-25T10:05:00.000Z"
          }
        });
      }
    });

    expect(screen.getByTestId("outcome-status-pill")).toHaveTextContent("completed");
    expect(screen.queryByTestId("outcome-status-pulse")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a command...")).not.toBeDisabled();
  });

  it("echoes a follow-up message into the thread immediately while the server action is pending", async () => {
    let resolveAction: (() => void) | null = null;

    const appendMessageAction = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        })
    );

    render(
      <OutcomeThreadPageShell
        {...buildProps()}
        appendMessageAction={appendMessageAction}
      />
    );

    const formData = new FormData();
    formData.set("content", "Make it shorter for principals.");
    formData.set("submissionId", "submit_local");

    await act(async () => {
      void observedFollowUpAction?.(formData);
      await Promise.resolve();
    });

    expect(observedOptimisticMessages).toEqual([
      expect.objectContaining({
        content: "Make it shorter for principals."
      })
    ]);
    expect(screen.getByText("Make it shorter for principals.")).toBeInTheDocument();

    await act(async () => {
      resolveAction?.();
      await Promise.resolve();
    });
  });

  it("removes an optimistic follow-up echo when the submit action fails", async () => {
    const appendMessageAction = vi
      .fn()
      .mockRejectedValue(new Error("Mycelium is still working on the current run."));

    render(
      <OutcomeThreadPageShell
        {...buildProps()}
        appendMessageAction={appendMessageAction}
      />
    );

    const formData = new FormData();
    formData.set("content", "Make it shorter for principals.");
    formData.set("submissionId", "submit_local");

    await expect(
      act(async () => {
        await observedFollowUpAction?.(formData);
      })
    ).rejects.toThrow("Mycelium is still working on the current run.");

    expect(observedOptimisticMessages).toEqual([]);
    expect(screen.queryByText("Make it shorter for principals.")).not.toBeInTheDocument();
  });

  it("reconciles an optimistic follow-up when the confirmed message arrives over SSE", async () => {
    let resolveAction: (() => void) | null = null;

    const appendMessageAction = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        })
    );

    render(
      <OutcomeThreadPageShell
        {...buildProps()}
        appendMessageAction={appendMessageAction}
      />
    );

    const formData = new FormData();
    formData.set("content", "Make it shorter for principals.");
    formData.set("submissionId", "submit_local");

    await act(async () => {
      void observedFollowUpAction?.(formData);
      await Promise.resolve();
    });

    expect(screen.getAllByText("Make it shorter for principals.")).toHaveLength(1);

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "message.created",
          data: {
            id: "msg_456",
            outcomeId: "outcome_123",
            role: "user",
            content: "Make it shorter for principals.",
            createdAt: "2026-03-25T10:03:00.000Z",
            submissionId: "submit_local"
          }
        });
      }
    });

    expect(observedOptimisticMessages).toEqual([]);
    expect(screen.queryByText("Make it shorter for principals.")).not.toBeInTheDocument();

    await act(async () => {
      resolveAction?.();
      await Promise.resolve();
    });
  });

  it("only reconciles one optimistic echo when the same follow-up is submitted twice", async () => {
    let resolveFirstAction: (() => void) | null = null;
    let resolveSecondAction: (() => void) | null = null;

    const appendMessageAction = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstAction = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSecondAction = resolve;
          })
      );

    render(
      <OutcomeThreadPageShell
        {...buildProps()}
        appendMessageAction={appendMessageAction}
      />
    );

    const firstFormData = new FormData();
    firstFormData.set("content", "Make it shorter.");
    firstFormData.set("submissionId", "submit_first");

    const secondFormData = new FormData();
    secondFormData.set("content", "Make it shorter.");
    secondFormData.set("submissionId", "submit_second");

    await act(async () => {
      void observedFollowUpAction?.(firstFormData);
      await Promise.resolve();
    });

    await act(async () => {
      void observedFollowUpAction?.(secondFormData);
      await Promise.resolve();
    });

    expect(observedOptimisticMessages).toHaveLength(2);

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "message.created",
          data: {
            id: "msg_789",
            outcomeId: "outcome_123",
            role: "user",
            content: "Make it shorter.",
            createdAt: "2026-03-25T10:03:00.000Z",
            submissionId: "submit_first"
          }
        });
      }
    });

    expect(observedOptimisticMessages).toHaveLength(1);
    expect(screen.getByText("Make it shorter.")).toBeInTheDocument();

    await act(async () => {
      resolveFirstAction?.();
      resolveSecondAction?.();
      await Promise.resolve();
    });
  });

  it("does not reconcile a local optimistic echo when another source confirms the same content first", async () => {
    let resolveAction: (() => void) | null = null;

    const appendMessageAction = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        })
    );

    render(
      <OutcomeThreadPageShell
        {...buildProps()}
        appendMessageAction={appendMessageAction}
      />
    );

    const formData = new FormData();
    formData.set("content", "Make it shorter.");
    formData.set("submissionId", "submit_local");

    await act(async () => {
      void observedFollowUpAction?.(formData);
      await Promise.resolve();
    });

    expect(observedOptimisticMessages).toEqual([
      expect.objectContaining({
        content: "Make it shorter.",
        submissionId: "submit_local"
      })
    ]);

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "message.created",
          data: {
            id: "msg_foreign",
            outcomeId: "outcome_123",
            role: "user",
            content: "Make it shorter.",
            createdAt: "2026-03-25T10:03:00.000Z",
            submissionId: "submit_foreign"
          }
        });
      }
    });

    expect(observedOptimisticMessages).toEqual([
      expect.objectContaining({
        content: "Make it shorter.",
        submissionId: "submit_local"
      })
    ]);

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "message.created",
          data: {
            id: "msg_local",
            outcomeId: "outcome_123",
            role: "user",
            content: "Make it shorter.",
            createdAt: "2026-03-25T10:04:00.000Z",
            submissionId: "submit_local"
          }
        });
      }
    });

    expect(observedOptimisticMessages).toEqual([]);

    await act(async () => {
      resolveAction?.();
      await Promise.resolve();
    });
  });
});
