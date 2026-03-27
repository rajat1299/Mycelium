import { z } from "zod";
import { ApprovalSchema } from "./approval";
import { ArtifactSchema } from "./artifact";
import {
  OutcomePresentationHintSchema,
  AssistantMessageSnapshotSchema,
  RunLogDataSchema
} from "./events";
import { OutcomeSchema } from "./outcome";
import { MessageCreatedDataSchema } from "./outcome-message";
import { PlanSchema, RunDetailSchema } from "./plan";

const PendingOutcomeThreadApprovalSchema = ApprovalSchema.refine(
  (approval) => approval.status === "pending",
  {
    message: "pendingApprovals must only include pending approvals."
  }
);

export const OutcomeThreadSnapshotSchema = z.object({
  outcome: OutcomeSchema,
  messages: z.array(MessageCreatedDataSchema),
  plans: z.array(PlanSchema),
  runs: z.array(RunDetailSchema),
  assistantMessages: z.array(AssistantMessageSnapshotSchema),
  artifacts: z.array(ArtifactSchema),
  logs: z.array(RunLogDataSchema),
  pendingApprovals: z.array(PendingOutcomeThreadApprovalSchema),
  presentationHints: z.array(OutcomePresentationHintSchema).default([])
});

export type OutcomeThreadSnapshot = z.infer<
  typeof OutcomeThreadSnapshotSchema
>;
