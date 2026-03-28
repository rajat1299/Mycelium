import { randomUUID } from "node:crypto";
import {
  OutcomePresentationHintSchema,
  sortOutcomePresentationHints,
  type OutcomePresentationHint
} from "@computer-oss/protocol";
import type { EventBus } from "./event-bus";
import type { Repositories } from "./repositories";

type StoredRunEvent = Awaited<ReturnType<Repositories["runs"]["listEvents"]>>[number];

type CreateOutcomePresentationHintInput = Omit<OutcomePresentationHint, "id"> & {
  id?: string;
};

type EmitOutcomePresentationHintInput = CreateOutcomePresentationHintInput & {
  runId: string;
};

export function createOutcomePresentationHint(
  input: CreateOutcomePresentationHintInput
) {
  return OutcomePresentationHintSchema.parse({
    id: input.id ?? `hint_${randomUUID()}`,
    outcomeId: input.outcomeId,
    entityType: input.entityType,
    entityId: input.entityId,
    phaseId: input.phaseId,
    seq: input.seq,
    ...(input.laneId ? { laneId: input.laneId } : {}),
    createdAt: input.createdAt
  });
}

export async function emitOutcomePresentationHint(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
  },
  input: EmitOutcomePresentationHintInput
) {
  const data = createOutcomePresentationHint(input);

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: input.runId,
    eventType: "presentation.hint",
    payload: data,
    createdAt: data.createdAt
  });

  options.eventBus.publish({
    outcomeId: data.outcomeId,
    type: "presentation.hint",
    data
  });

  return data;
}

export function buildOutcomePresentationHintsFromEvents(events: StoredRunEvent[]) {
  const hints = events
    .filter((event) => event.eventType === "presentation.hint")
    .map((event) => OutcomePresentationHintSchema.parse(event.payload));
  return sortOutcomePresentationHints(hints);
}
