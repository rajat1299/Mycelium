import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AssistantNarrativeBlock } from "./assistant-narrative-block";

afterEach(() => {
  cleanup();
});

describe("AssistantNarrativeBlock", () => {
  it("renders acknowledgment messages as subdued narrative copy", () => {
    render(
      <AssistantNarrativeBlock
        message={{
          id: "assistant_ack",
          runId: "run_123",
          kind: "acknowledgment",
          content: "I’ll start by loading context and framing the work.",
          createdAt: "2026-03-26T16:00:00.000Z",
          updatedAt: "2026-03-26T16:00:05.000Z",
          status: "completed"
        }}
      />
    );

    const block = screen.getByTestId("assistant-narrative-block");
    expect(block).toHaveAttribute("data-kind", "acknowledgment");
    expect(block).toHaveClass("text-muted");
    expect(
      screen.getByText("I’ll start by loading context and framing the work.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Phase")).not.toBeInTheDocument();
    expect(screen.queryByText("Delivery")).not.toBeInTheDocument();
  });

  it("renders transition messages as phase headers", () => {
    render(
      <AssistantNarrativeBlock
        message={{
          id: "assistant_transition",
          runId: "run_123",
          kind: "transition",
          content: "I’m splitting the work into four parallel research tracks.",
          createdAt: "2026-03-26T16:01:00.000Z",
          updatedAt: "2026-03-26T16:01:05.000Z",
          status: "completed"
        }}
      />
    );

    expect(screen.getByText("Phase")).toBeInTheDocument();
    expect(
      screen.getByText("I’m splitting the work into four parallel research tracks.")
    ).toBeInTheDocument();
  });

  it("renders delivery messages as stronger result summaries", () => {
    render(
      <AssistantNarrativeBlock
        message={{
          id: "assistant_delivery",
          runId: "run_123",
          kind: "delivery",
          content: "Here’s the final brief with the key recommendation and open risk.",
          createdAt: "2026-03-26T16:02:00.000Z",
          updatedAt: "2026-03-26T16:02:05.000Z",
          status: "completed"
        }}
      />
    );

    const block = screen.getByTestId("assistant-narrative-block");
    expect(block).toHaveAttribute("data-kind", "delivery");
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Here’s the final brief with the key recommendation and open risk."
      )
    ).toBeInTheDocument();
  });
});
