import {
  ApprovalSchema,
  AssistantMessageCompletedDataSchema,
  AssistantMessageDeltaDataSchema,
  AssistantMessageStartedDataSchema,
  ArtifactSchema,
  CheckpointSummarySchema,
  MessagingConnectionSchema,
  MessagingDeliverySchema,
  MessageCreatedDataSchema,
  OutcomeSchema,
  OutcomePresentationHintSchema,
  PlanSchema,
  RemoteStepLifecycleEventDataSchema,
  RemoteWorkerSchema,
  ResumeRunResponseSchema,
  RunInterruptedDataSchema,
  RunLogDataSchema,
  RunSchema,
  ScheduleFireSummarySchema,
  ScheduleSchema,
  RunStepSchema,
  type OutcomeStreamEvent
} from "@computer-oss/protocol";

type EventHandler = (event: OutcomeStreamEvent) => void;
type OutcomeEventDataByType = {
  [K in OutcomeStreamEvent["type"]]: Extract<OutcomeStreamEvent, { type: K }>["data"];
};

type SharedOutcomeSource = {
  source: EventSource;
  handlers: Set<EventHandler>;
  listeners: Array<{
    type: string;
    listener: EventListener;
  }>;
};

const sharedOutcomeSources = new Map<string, SharedOutcomeSource>();

export function subscribeToOutcomeEvents(
  outcomeId: string,
  onEvent: EventHandler
): () => void {
  let sharedSource = sharedOutcomeSources.get(outcomeId);

  if (!sharedSource) {
    const source = new EventSource(`/api/outcomes/${outcomeId}/events`);
    const handlers = new Set<EventHandler>();
    const listeners: SharedOutcomeSource["listeners"] = [];

    const registerListener = <T extends OutcomeStreamEvent["type"]>(
      type: T,
      parser: (payload: unknown) => OutcomeEventDataByType[T]
    ) => {
      const listener = ((event: Event) => {
        const message = event as MessageEvent<string>;
        let data: OutcomeEventDataByType[T];

        try {
          data = parser(JSON.parse(message.data));
        } catch (error) {
          console.error(`Failed to parse outcome event "${type}"`, {
            outcomeId,
            rawData: message.data,
            error
          });
          return;
        }

        const parsed = {
          outcomeId,
          type,
          data
        } as OutcomeStreamEvent;

        for (const handler of handlers) {
          handler(parsed);
        }
      }) as EventListener;

      source.addEventListener(type, listener);
      listeners.push({ type, listener });
    };

    registerListener("outcome.updated", (payload) => OutcomeSchema.parse(payload));
    registerListener("message.created", (payload) =>
      MessageCreatedDataSchema.parse(payload)
    );
    registerListener("plan.created", (payload) => PlanSchema.parse(payload));
    registerListener("assistant.message.started", (payload) =>
      AssistantMessageStartedDataSchema.parse(payload)
    );
    registerListener("assistant.message.delta", (payload) =>
      AssistantMessageDeltaDataSchema.parse(payload)
    );
    registerListener("assistant.message.completed", (payload) =>
      AssistantMessageCompletedDataSchema.parse(payload)
    );
    registerListener("presentation.hint", (payload) =>
      OutcomePresentationHintSchema.parse(payload)
    );
    registerListener("run.created", (payload) => RunSchema.parse(payload));
    registerListener("run.updated", (payload) => RunSchema.parse(payload));
    registerListener("run.log", (payload) => RunLogDataSchema.parse(payload));
    registerListener("artifact.created", (payload) => ArtifactSchema.parse(payload));
    registerListener("checkpoint.created", (payload) =>
      CheckpointSummarySchema.parse(payload)
    );
    registerListener("run.step.updated", (payload) => RunStepSchema.parse(payload));
    registerListener("approval.requested", (payload) => ApprovalSchema.parse(payload));
    registerListener("approval.resolved", (payload) => ApprovalSchema.parse(payload));
    registerListener("worker.connected", (payload) =>
      RemoteWorkerSchema.parse(payload)
    );
    registerListener("worker.disconnected", (payload) =>
      RemoteWorkerSchema.parse(payload)
    );
    registerListener("remote.step.updated", (payload) =>
      RemoteStepLifecycleEventDataSchema.parse(payload)
    );
    registerListener("run.interrupted", (payload) =>
      RunInterruptedDataSchema.parse(payload)
    );
    registerListener("run.resumed", (payload) =>
      ResumeRunResponseSchema.parse(payload)
    );
    registerListener("schedule.updated", (payload) =>
      ScheduleSchema.parse(payload)
    );
    registerListener("schedule.fired", (payload) =>
      ScheduleFireSummarySchema.parse(payload)
    );
    registerListener("messaging.connection.updated", (payload) =>
      MessagingConnectionSchema.parse(payload)
    );
    registerListener("messaging.delivery.updated", (payload) =>
      MessagingDeliverySchema.parse(payload)
    );

    sharedSource = {
      source,
      handlers,
      listeners
    };
    sharedOutcomeSources.set(outcomeId, sharedSource);
  }

  sharedSource.handlers.add(onEvent);

  return () => {
    const current = sharedOutcomeSources.get(outcomeId);

    if (!current) {
      return;
    }

    current.handlers.delete(onEvent);

    if (current.handlers.size > 0) {
      return;
    }

    for (const { type, listener } of current.listeners) {
      current.source.removeEventListener(type, listener);
    }

    current.source.close();
    sharedOutcomeSources.delete(outcomeId);
  };
}
