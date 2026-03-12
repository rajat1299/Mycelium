import { describe, expect, it } from "vitest";
import {
  RunStatusSchema,
  StepStatusSchema,
  canTransitionRunStatus,
  canTransitionStepStatus
} from "./run-state";

describe("run state", () => {
  it("defines the allowed run and step statuses", () => {
    expect(RunStatusSchema.options).toEqual([
      "draft",
      "queued",
      "planning",
      "waiting_for_worker",
      "running",
      "blocked",
      "completed",
      "failed",
      "cancelled"
    ]);

    expect(StepStatusSchema.options).toEqual([
      "pending",
      "ready",
      "claimed",
      "running",
      "blocked",
      "completed",
      "failed",
      "cancelled"
    ]);
  });

  it("accepts valid run transitions and rejects invalid ones", () => {
    expect(canTransitionRunStatus("draft", "planning")).toBe(true);
    expect(canTransitionRunStatus("planning", "queued")).toBe(true);
    expect(canTransitionRunStatus("running", "completed")).toBe(true);

    expect(canTransitionRunStatus("draft", "completed")).toBe(false);
    expect(canTransitionRunStatus("completed", "running")).toBe(false);
  });

  it("accepts valid step transitions and rejects invalid ones", () => {
    expect(canTransitionStepStatus("pending", "ready")).toBe(true);
    expect(canTransitionStepStatus("ready", "claimed")).toBe(true);
    expect(canTransitionStepStatus("claimed", "running")).toBe(true);
    expect(canTransitionStepStatus("running", "completed")).toBe(true);

    expect(canTransitionStepStatus("pending", "running")).toBe(false);
    expect(canTransitionStepStatus("completed", "running")).toBe(false);
  });
});
