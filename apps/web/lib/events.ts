import {
  ArtifactSchema,
  MessageCreatedDataSchema,
  OutcomeSchema,
  PlanSchema,
  RunLogDataSchema,
  RunSchema,
  RunStepSchema,
  type OutcomeStreamEvent
} from "@computer-oss/protocol";

type EventHandler = (event: OutcomeStreamEvent) => void;

export function subscribeToOutcomeEvents(
  outcomeId: string,
  onEvent: EventHandler
): () => void {
  const source = new EventSource(`/api/outcomes/${outcomeId}/events`);

  const handleOutcomeUpdated = (event: Event) => {
    const message = event as MessageEvent<string>;

    onEvent({
      outcomeId,
      type: "outcome.updated",
      data: OutcomeSchema.parse(JSON.parse(message.data))
    });
  };

  const handleMessageCreated = (event: Event) => {
    const message = event as MessageEvent<string>;
    const parsed = MessageCreatedDataSchema.parse(JSON.parse(message.data));

    onEvent({
      outcomeId,
      type: "message.created",
      data: parsed
    });
  };

  const handlePlanCreated = (event: Event) => {
    const message = event as MessageEvent<string>;

    onEvent({
      outcomeId,
      type: "plan.created",
      data: PlanSchema.parse(JSON.parse(message.data))
    });
  };

  const handleRunCreated = (event: Event) => {
    const message = event as MessageEvent<string>;

    onEvent({
      outcomeId,
      type: "run.created",
      data: RunSchema.parse(JSON.parse(message.data))
    });
  };

  const handleRunStepUpdated = (event: Event) => {
    const message = event as MessageEvent<string>;

    onEvent({
      outcomeId,
      type: "run.step.updated",
      data: RunStepSchema.parse(JSON.parse(message.data))
    });
  };

  const handleRunUpdated = (event: Event) => {
    const message = event as MessageEvent<string>;

    onEvent({
      outcomeId,
      type: "run.updated",
      data: RunSchema.parse(JSON.parse(message.data))
    });
  };

  const handleRunLog = (event: Event) => {
    const message = event as MessageEvent<string>;

    onEvent({
      outcomeId,
      type: "run.log",
      data: RunLogDataSchema.parse(JSON.parse(message.data))
    });
  };

  const handleArtifactCreated = (event: Event) => {
    const message = event as MessageEvent<string>;

    onEvent({
      outcomeId,
      type: "artifact.created",
      data: ArtifactSchema.parse(JSON.parse(message.data))
    });
  };

  source.addEventListener("outcome.updated", handleOutcomeUpdated as EventListener);
  source.addEventListener("message.created", handleMessageCreated as EventListener);
  source.addEventListener("plan.created", handlePlanCreated as EventListener);
  source.addEventListener("run.created", handleRunCreated as EventListener);
  source.addEventListener("run.updated", handleRunUpdated as EventListener);
  source.addEventListener("run.log", handleRunLog as EventListener);
  source.addEventListener(
    "artifact.created",
    handleArtifactCreated as EventListener
  );
  source.addEventListener(
    "run.step.updated",
    handleRunStepUpdated as EventListener
  );

  return () => {
    source.removeEventListener(
      "outcome.updated",
      handleOutcomeUpdated as EventListener
    );
    source.removeEventListener(
      "message.created",
      handleMessageCreated as EventListener
    );
    source.removeEventListener("plan.created", handlePlanCreated as EventListener);
    source.removeEventListener("run.created", handleRunCreated as EventListener);
    source.removeEventListener("run.updated", handleRunUpdated as EventListener);
    source.removeEventListener("run.log", handleRunLog as EventListener);
    source.removeEventListener(
      "artifact.created",
      handleArtifactCreated as EventListener
    );
    source.removeEventListener(
      "run.step.updated",
      handleRunStepUpdated as EventListener
    );
    source.close();
  };
}
