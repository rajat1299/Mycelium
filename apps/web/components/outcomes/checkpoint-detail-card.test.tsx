import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CheckpointDetail } from "@computer-oss/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckpointDetailCard } from "./checkpoint-detail-card";

const checkpoint: CheckpointDetail = {
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
  createdAt: "2026-03-16T12:05:00.000Z",
  payload: {
    version: 1,
    run: {
      id: "run_123",
      outcomeId: "outcome_123",
      workspaceId: "ws_default",
      status: "interrupted"
    },
    steps: [
      {
        stepId: "step_brief",
        title: "Draft brief",
        status: "completed"
      },
      {
        stepId: "step_final",
        title: "Synthesize result",
        status: "ready"
      }
    ],
    readyStepIds: ["step_final"],
    blockedStepIds: [],
    workspacePaths: {
      inputDir: "/tmp/run_123/input",
      logsDir: "/tmp/run_123/logs",
      artifactsDir: "/tmp/run_123/artifacts"
    },
    artifactIds: ["artifact_1", "artifact_2"],
    latestAuditSequence: 7
  }
};

afterEach(() => {
  cleanup();
});

describe("CheckpointDetailCard", () => {
  it("renders the selected checkpoint detail and allows resuming an interrupted run", () => {
    const onResume = vi.fn();

    render(
      <CheckpointDetailCard
        run={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_123",
          status: "interrupted",
          latestCheckpointId: "checkpoint_3",
          resumable: true,
          createdAt: "2026-03-16T12:00:00.000Z",
          updatedAt: "2026-03-16T12:06:00.000Z",
          steps: []
        }}
        checkpoint={checkpoint}
        onResume={onResume}
        isResuming={false}
      />
    );

    expect(screen.getByText("Checkpoint #3")).toBeInTheDocument();
    expect(screen.getByText("/tmp/run_123/artifacts")).toBeInTheDocument();
    expect(screen.getByText("Draft brief")).toBeInTheDocument();
    expect(screen.getByText("latest audit sequence 7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /resume from checkpoint/i }));

    expect(onResume).toHaveBeenCalledWith("checkpoint_3");
  });

  it("hides the resume action when the run is not interrupted and resumable", () => {
    render(
      <CheckpointDetailCard
        run={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_123",
          status: "running",
          latestCheckpointId: "checkpoint_3",
          resumable: false,
          createdAt: "2026-03-16T12:00:00.000Z",
          updatedAt: "2026-03-16T12:06:00.000Z",
          steps: []
        }}
        checkpoint={checkpoint}
        onResume={vi.fn()}
        isResuming={false}
      />
    );

    expect(
      screen.queryByRole("button", { name: /resume from checkpoint/i })
    ).not.toBeInTheDocument();
  });
});
