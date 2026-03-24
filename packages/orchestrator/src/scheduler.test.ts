import { describe, expect, it } from "vitest";
import { createDeterministicDraftPlan } from "./planner";
import {
  isRunTerminal,
  listNewlyReadySteps,
  listReadySteps,
  type SchedulerStepState
} from "./scheduler";

function buildForkJoinPlan() {
  return createDeterministicDraftPlan({
    outcomeId: "outcome_123",
    triggerMessageId: "msg_turn_123",
    prompt: "Draft a brief and operator summary in parallel.",
    createdAt: "2026-03-12T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:00.000Z"
  });
}

function buildStepStates(): SchedulerStepState[] {
  return [
    {
      id: "step_analyze",
      planNodeId: "plan_outcome_123_msg_turn_123:analyze-outcome",
      status: "ready"
    },
    {
      id: "step_brief",
      planNodeId: "plan_outcome_123_msg_turn_123:draft-brief",
      status: "pending"
    },
    {
      id: "step_summary",
      planNodeId: "plan_outcome_123_msg_turn_123:draft-operator-summary",
      status: "pending"
    },
    {
      id: "step_synthesize",
      planNodeId: "plan_outcome_123_msg_turn_123:synthesize-result",
      status: "pending"
    }
  ];
}

describe("scheduler", () => {
  it("lists dependency-free ready steps from the current graph state", () => {
    const plan = buildForkJoinPlan();
    const steps = buildStepStates().map((step) =>
      step.id === "step_analyze"
        ? { ...step, status: "completed" as const }
        : step.id === "step_brief" || step.id === "step_summary"
          ? { ...step, status: "ready" as const }
          : step
    );

    expect(listReadySteps(plan, steps).map((step) => step.id)).toEqual([
      "step_brief",
      "step_summary"
    ]);
  });

  it("keeps synthesis blocked until both worker branches complete", () => {
    const plan = buildForkJoinPlan();
    const steps = buildStepStates().map((step) =>
      step.id === "step_analyze"
        ? { ...step, status: "completed" as const }
        : step.id === "step_brief"
          ? { ...step, status: "completed" as const }
          : step.id === "step_summary"
            ? { ...step, status: "running" as const }
            : step
    );

    expect(listNewlyReadySteps(plan, steps, "step_brief")).toEqual([]);
  });

  it("ignores ready steps whose planNodeId is not present in the plan", () => {
    const plan = buildForkJoinPlan();
    const steps = [
      ...buildStepStates(),
      {
        id: "step_unknown",
        planNodeId: "plan_outcome_123_msg_turn_123:unknown-node",
        status: "ready" as const
      }
    ];

    expect(listReadySteps(plan, steps).map((step) => step.id)).toEqual(["step_analyze"]);
  });

  it("unlocks synthesis after both worker branches complete and detects terminal completion", () => {
    const plan = buildForkJoinPlan();
    const readyForJoin = buildStepStates().map((step) =>
      step.id === "step_analyze" ||
      step.id === "step_brief" ||
      step.id === "step_summary"
        ? { ...step, status: "completed" as const }
        : step
    );

    expect(listNewlyReadySteps(plan, readyForJoin, "step_summary")).toEqual([
      expect.objectContaining({
        id: "step_synthesize",
        planNodeId: "plan_outcome_123_msg_turn_123:synthesize-result"
      })
    ]);

    const completedRun = readyForJoin.map((step) =>
      step.id === "step_synthesize"
        ? { ...step, status: "completed" as const }
        : step
    );

    expect(isRunTerminal(completedRun)).toBe(true);
  });
});
