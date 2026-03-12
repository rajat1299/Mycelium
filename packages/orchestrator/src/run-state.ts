import { z } from "zod";

export const RunStatusSchema = z.enum([
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

export const StepStatusSchema = z.enum([
  "pending",
  "ready",
  "claimed",
  "running",
  "blocked",
  "completed",
  "failed",
  "cancelled"
]);

export type RunStatus = z.infer<typeof RunStatusSchema>;
export type StepStatus = z.infer<typeof StepStatusSchema>;

const runTransitions: Record<RunStatus, readonly RunStatus[]> = {
  draft: ["planning", "cancelled"],
  planning: ["queued", "failed", "cancelled"],
  queued: ["waiting_for_worker", "running", "failed", "cancelled"],
  waiting_for_worker: ["running", "blocked", "failed", "cancelled"],
  running: ["blocked", "completed", "failed", "cancelled"],
  blocked: ["queued", "running", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: []
};

const stepTransitions: Record<StepStatus, readonly StepStatus[]> = {
  pending: ["ready", "cancelled"],
  ready: ["claimed", "blocked", "failed", "cancelled"],
  claimed: ["running", "blocked", "failed", "cancelled"],
  running: ["blocked", "completed", "failed", "cancelled"],
  blocked: ["ready", "running", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: []
};

export function canTransitionRunStatus(
  current: RunStatus,
  next: RunStatus
): boolean {
  return runTransitions[current].includes(next);
}

export function canTransitionStepStatus(
  current: StepStatus,
  next: StepStatus
): boolean {
  return stepTransitions[current].includes(next);
}
