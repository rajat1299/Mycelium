import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutcomeThreadPageShell } from "./outcome-thread-page-shell";

const eventStream = vi.hoisted(() => ({
  handlers: new Set<(event: any) => void>()
}));

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
  OutcomeConversation: () => <div data-testid="outcome-conversation" />
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
  });

  afterEach(() => {
    cleanup();
    eventStream.handlers.clear();
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
});
