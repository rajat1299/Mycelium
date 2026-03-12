import type { Outcome, Plan, RunDetail } from "@computer-oss/protocol";

export type OutcomeListItem = Pick<
  Outcome,
  "id" | "prompt" | "status" | "updatedAt"
>;

export type ActivityEntry = {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  tone?: "default" | "accent" | "success" | "warning";
};

export type OutcomeOrchestrationSnapshot = {
  plan: Plan | null;
  run: RunDetail | null;
};
