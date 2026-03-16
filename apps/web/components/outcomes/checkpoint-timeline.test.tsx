import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CheckpointTimeline } from "./checkpoint-timeline";

describe("CheckpointTimeline", () => {
  it("renders checkpoints newest-first and lets the operator change selection", () => {
    const onSelectCheckpoint = vi.fn();

    render(
      <CheckpointTimeline
        selectedRunId="run_123"
        checkpoints={[
          {
            id: "checkpoint_1",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            sequence: 1,
            kind: "run_started",
            resumable: true,
            storeKey: "run_123/000001.json",
            checksum: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            byteSize: 512,
            stepId: null,
            createdAt: "2026-03-16T12:00:00.000Z"
          },
          {
            id: "checkpoint_3",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            sequence: 3,
            kind: "step_completed",
            resumable: true,
            storeKey: "run_123/000003.json",
            checksum: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            byteSize: 1024,
            stepId: "step_final",
            createdAt: "2026-03-16T12:05:00.000Z"
          },
          {
            id: "checkpoint_2",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            sequence: 2,
            kind: "step_completed",
            resumable: true,
            storeKey: "run_123/000002.json",
            checksum: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            byteSize: 768,
            stepId: "step_brief",
            createdAt: "2026-03-16T12:03:00.000Z"
          }
        ]}
        selectedCheckpointId="checkpoint_3"
        onSelectCheckpoint={onSelectCheckpoint}
      />
    );

    const buttons = screen.getAllByRole("button");

    expect(buttons.map((button) => button.textContent)).toEqual([
      expect.stringContaining("Checkpoint #3"),
      expect.stringContaining("Checkpoint #2"),
      expect.stringContaining("Checkpoint #1")
    ]);
    expect(screen.getByRole("button", { name: /checkpoint #3/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: /checkpoint #1/i }));

    expect(onSelectCheckpoint).toHaveBeenCalledWith("checkpoint_1");
  });
});
