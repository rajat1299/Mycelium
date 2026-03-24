import { z } from "zod";
import { ApprovalSchema } from "./approval";
import { ArtifactSchema } from "./artifact";
import {
  CheckpointSummarySchema,
  ResumeRunResponseSchema,
  RunInterruptedDataSchema
} from "./checkpoint";
import {
  MessagingConnectionSchema,
  MessagingDeliverySchema
} from "./messaging";
import { MessageCreatedDataSchema } from "./outcome-message";
import { OutcomeSchema } from "./outcome";
import { PlanSchema, RunSchema, RunStepSchema } from "./plan";
import {
  RemoteStepLifecycleEventDataSchema,
  RemoteWorkerSchema
} from "./remote-worker";
import { ScheduleFireSummarySchema, ScheduleSchema } from "./schedule";

export const EventTypeSchema = z.enum([
  "outcome.updated",
  "plan.created",
  "plan_node.updated",
  "assistant.message.started",
  "assistant.message.delta",
  "assistant.message.completed",
  "run.created",
  "run.step.updated",
  "run.updated",
  "run.log",
  "artifact.created",
  "checkpoint.created",
  "approval.requested",
  "approval.resolved",
  "worker.connected",
  "worker.disconnected",
  "remote.step.updated",
  "run.interrupted",
  "run.resumed",
  "schedule.updated",
  "schedule.fired",
  "message.created",
  "messaging.connection.updated",
  "messaging.delivery.updated"
]);

export const AssistantMessageKindSchema = z.enum([
  "acknowledgment",
  "transition",
  "delivery"
]);

export const AssistantMessageStartedDataSchema = z.object({
  messageId: z.string(),
  runId: z.string(),
  kind: AssistantMessageKindSchema,
  createdAt: z.string().datetime()
});

export const AssistantMessageDeltaDataSchema = z.object({
  messageId: z.string(),
  runId: z.string(),
  kind: AssistantMessageKindSchema,
  delta: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const AssistantMessageCompletedDataSchema = z.object({
  messageId: z.string(),
  runId: z.string(),
  kind: AssistantMessageKindSchema,
  content: z.string(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime()
});

export const AssistantMessageStatusSchema = z.enum(["streaming", "completed"]);

export const AssistantMessageSnapshotSchema = z.object({
  id: z.string(),
  runId: z.string(),
  kind: AssistantMessageKindSchema,
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: AssistantMessageStatusSchema
});

export const AssistantMessageListResponseSchema = z.object({
  assistantMessages: z.array(AssistantMessageSnapshotSchema)
});

export const OutcomeMessageListResponseSchema = z.object({
  messages: z.array(MessageCreatedDataSchema)
});

export const EventEnvelopeSchema = z.object({
  type: EventTypeSchema,
  data: z.unknown()
});

export const OutcomeUpdatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("outcome.updated"),
  data: OutcomeSchema
});

export const MessageCreatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("message.created"),
  data: MessageCreatedDataSchema
});

export const PlanCreatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("plan.created"),
  data: PlanSchema
});

export const AssistantMessageStartedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("assistant.message.started"),
  data: AssistantMessageStartedDataSchema
});

export const AssistantMessageDeltaEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("assistant.message.delta"),
  data: AssistantMessageDeltaDataSchema
});

export const AssistantMessageCompletedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("assistant.message.completed"),
  data: AssistantMessageCompletedDataSchema
});

export const RunCreatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("run.created"),
  data: RunSchema
});

export const RunStepUpdatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("run.step.updated"),
  data: RunStepSchema
});

export const RunUpdatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("run.updated"),
  data: RunSchema
});

export const RunLogDataSchema = z.object({
  runId: z.string(),
  stepId: z.string().optional(),
  stepTitle: z.string().optional(),
  level: z.enum(["info", "error"]),
  message: z.string().min(1),
  createdAt: z.string().datetime()
});

export const RunLogEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("run.log"),
  data: RunLogDataSchema
});

export const RunLogListResponseSchema = z.object({
  logs: z.array(RunLogDataSchema)
});

export const ArtifactCreatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("artifact.created"),
  data: ArtifactSchema
});

export const CheckpointCreatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("checkpoint.created"),
  data: CheckpointSummarySchema
});

export const ApprovalRequestedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("approval.requested"),
  data: ApprovalSchema
});

export const ApprovalResolvedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("approval.resolved"),
  data: ApprovalSchema
});

export const WorkerConnectedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("worker.connected"),
  data: RemoteWorkerSchema
});

export const WorkerDisconnectedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("worker.disconnected"),
  data: RemoteWorkerSchema
});

export const RemoteStepUpdatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("remote.step.updated"),
  data: RemoteStepLifecycleEventDataSchema
});

export const RunInterruptedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("run.interrupted"),
  data: RunInterruptedDataSchema
});

export const RunResumedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("run.resumed"),
  data: ResumeRunResponseSchema
});

export const ScheduleUpdatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("schedule.updated"),
  data: ScheduleSchema
});

export const ScheduleFiredEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("schedule.fired"),
  data: ScheduleFireSummarySchema
});

export const MessagingConnectionUpdatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("messaging.connection.updated"),
  data: MessagingConnectionSchema
});

export const MessagingDeliveryUpdatedEventSchema = z.object({
  outcomeId: z.string(),
  type: z.literal("messaging.delivery.updated"),
  data: MessagingDeliverySchema
});

export const OutcomeStreamEventSchema = z.discriminatedUnion("type", [
  OutcomeUpdatedEventSchema,
  MessageCreatedEventSchema,
  PlanCreatedEventSchema,
  AssistantMessageStartedEventSchema,
  AssistantMessageDeltaEventSchema,
  AssistantMessageCompletedEventSchema,
  RunCreatedEventSchema,
  RunStepUpdatedEventSchema,
  RunUpdatedEventSchema,
  RunLogEventSchema,
  ArtifactCreatedEventSchema,
  CheckpointCreatedEventSchema,
  ApprovalRequestedEventSchema,
  ApprovalResolvedEventSchema,
  WorkerConnectedEventSchema,
  WorkerDisconnectedEventSchema,
  RemoteStepUpdatedEventSchema,
  RunInterruptedEventSchema,
  RunResumedEventSchema,
  ScheduleUpdatedEventSchema,
  ScheduleFiredEventSchema,
  MessagingConnectionUpdatedEventSchema,
  MessagingDeliveryUpdatedEventSchema
]);

export type EventType = z.infer<typeof EventTypeSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type { MessageCreatedData } from "./outcome-message";
export type AssistantMessageKind = z.infer<typeof AssistantMessageKindSchema>;
export type AssistantMessageStartedData = z.infer<
  typeof AssistantMessageStartedDataSchema
>;
export type AssistantMessageDeltaData = z.infer<
  typeof AssistantMessageDeltaDataSchema
>;
export type AssistantMessageCompletedData = z.infer<
  typeof AssistantMessageCompletedDataSchema
>;
export type AssistantMessageStatus = z.infer<typeof AssistantMessageStatusSchema>;
export type AssistantMessageSnapshot = z.infer<
  typeof AssistantMessageSnapshotSchema
>;
export type OutcomeUpdatedEvent = z.infer<typeof OutcomeUpdatedEventSchema>;
export type MessageCreatedEvent = z.infer<typeof MessageCreatedEventSchema>;
export type PlanCreatedEvent = z.infer<typeof PlanCreatedEventSchema>;
export type AssistantMessageStartedEvent = z.infer<
  typeof AssistantMessageStartedEventSchema
>;
export type AssistantMessageDeltaEvent = z.infer<
  typeof AssistantMessageDeltaEventSchema
>;
export type AssistantMessageCompletedEvent = z.infer<
  typeof AssistantMessageCompletedEventSchema
>;
export type RunCreatedEvent = z.infer<typeof RunCreatedEventSchema>;
export type RunStepUpdatedEvent = z.infer<typeof RunStepUpdatedEventSchema>;
export type RunUpdatedEvent = z.infer<typeof RunUpdatedEventSchema>;
export type RunLogData = z.infer<typeof RunLogDataSchema>;
export type RunLogEvent = z.infer<typeof RunLogEventSchema>;
export type RunLogListResponse = z.infer<typeof RunLogListResponseSchema>;
export type AssistantMessageListResponse = z.infer<
  typeof AssistantMessageListResponseSchema
>;
export type OutcomeMessageListResponse = z.infer<
  typeof OutcomeMessageListResponseSchema
>;
export type ArtifactCreatedEvent = z.infer<typeof ArtifactCreatedEventSchema>;
export type CheckpointCreatedEvent = z.infer<typeof CheckpointCreatedEventSchema>;
export type ApprovalRequestedEvent = z.infer<typeof ApprovalRequestedEventSchema>;
export type ApprovalResolvedEvent = z.infer<typeof ApprovalResolvedEventSchema>;
export type WorkerConnectedEvent = z.infer<typeof WorkerConnectedEventSchema>;
export type WorkerDisconnectedEvent = z.infer<
  typeof WorkerDisconnectedEventSchema
>;
export type RemoteStepUpdatedEvent = z.infer<typeof RemoteStepUpdatedEventSchema>;
export type RunInterruptedEvent = z.infer<typeof RunInterruptedEventSchema>;
export type RunResumedEvent = z.infer<typeof RunResumedEventSchema>;
export type ScheduleUpdatedEvent = z.infer<typeof ScheduleUpdatedEventSchema>;
export type ScheduleFiredEvent = z.infer<typeof ScheduleFiredEventSchema>;
export type MessagingConnectionUpdatedEvent = z.infer<
  typeof MessagingConnectionUpdatedEventSchema
>;
export type MessagingDeliveryUpdatedEvent = z.infer<
  typeof MessagingDeliveryUpdatedEventSchema
>;
export type OutcomeStreamEvent = z.infer<typeof OutcomeStreamEventSchema>;
