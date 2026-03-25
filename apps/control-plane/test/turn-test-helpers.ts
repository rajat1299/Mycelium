import type { CreatePlanInput, CreateRunFromPlanInput } from "@computer-oss/db";
import type { Repositories } from "../src/lib/repositories";

let testTurnSequence = 0;

function nextTurnSequence() {
  testTurnSequence += 1;
  return testTurnSequence;
}

export async function appendUserTurnMessage(
  repositories: Repositories,
  input: {
    outcomeId: string;
    content: string;
    createdAt: string;
    id?: string;
  }
) {
  const message = {
    id: input.id ?? `msg_test_turn_${nextTurnSequence()}`,
    outcomeId: input.outcomeId,
    role: "user" as const,
    content: input.content,
    submissionId: null,
    createdAt: input.createdAt
  };

  await repositories.outcomes.appendMessage(message);
  return message;
}

export async function createPlanForOutcomeTurn(
  repositories: Repositories,
  input: Omit<CreatePlanInput, "triggerMessageId"> & {
    triggerMessageId?: string;
    triggerMessageContent?: string;
    triggerMessageCreatedAt?: string;
  }
) {
  const triggerMessageId =
    input.triggerMessageId ??
    (
      await appendUserTurnMessage(repositories, {
        outcomeId: input.outcomeId,
        content: input.triggerMessageContent ?? `Trigger message for ${input.id}`,
        createdAt: input.triggerMessageCreatedAt ?? input.createdAt
      })
    ).id;

  return repositories.plans.create({
    ...input,
    triggerMessageId
  });
}

export async function createRunForExistingPlan(
  repositories: Repositories,
  input: Omit<CreateRunFromPlanInput, "triggerMessageId"> & {
    triggerMessageId?: string;
  }
) {
  const triggerMessageId =
    input.triggerMessageId ??
    (await repositories.plans.getById(input.planId))?.triggerMessageId;

  if (!triggerMessageId) {
    throw new Error(`Plan ${input.planId} is missing a trigger message.`);
  }

  return repositories.runs.createFromPlan({
    ...input,
    triggerMessageId
  });
}
