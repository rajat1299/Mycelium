import type { Outcome } from "@computer-oss/protocol";

export type OutcomeListItem = Pick<
  Outcome,
  "id" | "prompt" | "status" | "updatedAt"
>;

export type ActivityEntry = {
  id: string;
  title: string;
  body: string;
  timestamp: string;
};
