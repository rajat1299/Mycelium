import type { EventEnvelope, OutcomeStreamEvent } from "@computer-oss/protocol";

type OutcomeEventListener = (event: OutcomeStreamEvent) => void;

export type EventBus = {
  publish(event: OutcomeStreamEvent): void;
  subscribe(outcomeId: string, listener: OutcomeEventListener): () => void;
  subscribeAll(listener: OutcomeEventListener): () => void;
};

export function createEventBus(): EventBus {
  const listenersByOutcome = new Map<string, Set<OutcomeEventListener>>();
  const listeners = new Set<OutcomeEventListener>();

  return {
    publish(event) {
      listeners.forEach((listener) => {
        listener(event);
      });

      listenersByOutcome.get(event.outcomeId)?.forEach((listener) => {
        listener(event);
      });
    },
    subscribe(outcomeId, listener) {
      const scoped = listenersByOutcome.get(outcomeId) ?? new Set<OutcomeEventListener>();
      scoped.add(listener);
      listenersByOutcome.set(outcomeId, scoped);

      return () => {
        scoped.delete(listener);

        if (scoped.size === 0) {
          listenersByOutcome.delete(outcomeId);
        }
      };
    },
    subscribeAll(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    }
  };
}

export function formatSseEvent(event: Pick<EventEnvelope, "type" | "data">): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
