import { randomUUID } from "node:crypto";
import {
  OutcomePresentationHintSchema,
  type OutcomePresentationHint,
  type OutcomePresentationHintEntityType
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
  return events
    .filter((event) => event.eventType === "presentation.hint")
    .map((event) => OutcomePresentationHintSchema.parse(event.payload))
    .sort(compareOutcomePresentationHints);
}

function compareOutcomePresentationHints(
  left: OutcomePresentationHint,
  right: OutcomePresentationHint
) {
  const createdAtDelta = left.createdAt.localeCompare(right.createdAt);

  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  const phaseDelta = left.phaseId.localeCompare(right.phaseId);

  if (phaseDelta !== 0) {
    return phaseDelta;
  }

  const seqDelta = left.seq - right.seq;

  if (seqDelta !== 0) {
    return seqDelta;
  }

  const entityTypeDelta = compareHintEntityType(left.entityType, right.entityType);

  if (entityTypeDelta !== 0) {
    return entityTypeDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareHintEntityType(
  left: OutcomePresentationHintEntityType,
  right: OutcomePresentationHintEntityType
) {
  const priority: Record<OutcomePresentationHintEntityType, number> = {
    "assistant-message": 0,
    step: 1,
    artifact: 2,
    approval: 3
  };

  return priority[left] - priority[right];
}
