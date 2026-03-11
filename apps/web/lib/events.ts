import {
  MessageCreatedDataSchema,
  OutcomeSchema,
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

  source.addEventListener("outcome.updated", handleOutcomeUpdated as EventListener);
  source.addEventListener("message.created", handleMessageCreated as EventListener);

  return () => {
    source.removeEventListener(
      "outcome.updated",
      handleOutcomeUpdated as EventListener
    );
    source.removeEventListener(
      "message.created",
      handleMessageCreated as EventListener
    );
    source.close();
  };
}
