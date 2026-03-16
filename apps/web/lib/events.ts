import {
  ApprovalSchema,
  ArtifactSchema,
  CheckpointSummarySchema,
  MessageCreatedDataSchema,
  OutcomeSchema,
  PlanSchema,
  ResumeRunResponseSchema,
  RunInterruptedDataSchema,
  RunLogDataSchema,
  RunSchema,
  RunStepSchema,
  type OutcomeStreamEvent
} from "@computer-oss/protocol";

type EventHandler = (event: OutcomeStreamEvent) => void;

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
      parser: (payload: unknown) => Extract<OutcomeStreamEvent, { type: T }>["data"]
    ) => {
      const listener = ((event: Event) => {
        const message = event as MessageEvent<string>;
        const parsed = {
          outcomeId,
          type,
          data: parser(JSON.parse(message.data))
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
    registerListener("run.interrupted", (payload) =>
      RunInterruptedDataSchema.parse(payload)
    );
    registerListener("run.resumed", (payload) =>
      ResumeRunResponseSchema.parse(payload)
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
