import type { FastifyInstance } from "fastify";
import {
  OutcomeThreadSnapshotSchema,
  ContinueOutcomeRequestSchema,
  CreateOutcomeMessageRequestSchema,
  CreateOutcomeRequestSchema,
  MessageCreatedDataSchema,
  OutcomeMessageListResponseSchema,
  OutcomeListResponseSchema,
  OutcomeSchema,
  OutcomeTurnResponseSchema,
  PlanSchema,
  RunDetailSchema,
  RunLogDataSchema,
  StartOutcomeRequestSchema
} from "@computer-oss/protocol";
import type { EventBus } from "../lib/event-bus";
import { buildOutcomePresentationHintsFromEvents } from "../lib/outcome-presentation";
import {
  OutcomeTurnConflictError,
  OutcomeTurnReplayConflictError,
  type OutcomeTurnService
} from "../lib/outcome-turn-service";
import type { Repositories } from "../lib/repositories";
import { buildAssistantMessageSnapshotsFromEvents } from "./runs";

type OutcomeRouteOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  outcomeTurnService: OutcomeTurnService;
};

function badRequest(message: string) {
  return {
    error: message
  };
}

async function buildThreadSnapshot(
  repositories: Repositories,
  outcomeId: string
) {
  const outcome = await repositories.outcomes.getById(outcomeId);

  if (!outcome) {
    return null;
  }

  const [messages, plans, runs, artifacts, events, workspaceApprovals] =
    await Promise.all([
      repositories.outcomes.listMessages(outcomeId),
      repositories.plans.listByOutcome(outcomeId),
      repositories.runs.listByOutcome(outcomeId),
      repositories.artifacts.listByOutcome(outcomeId),
      repositories.runs.listEventsByOutcome(outcomeId),
      repositories.approvals.listByWorkspace({
        workspaceId: outcome.workspaceId,
        status: "pending"
      })
    ]);

  const [planDetails, runDetails] = await Promise.all([
    Promise.all(
      plans.map(async (plan) =>
        PlanSchema.parse({
          ...plan,
          nodes: await repositories.plans.listNodes(plan.id),
          edges: await repositories.plans.listEdges(plan.id)
        })
      )
    ),
    Promise.all(
      runs.map(async (run) =>
        RunDetailSchema.parse({
          ...run,
          steps: await repositories.runs.listSteps(run.id)
        })
      )
    )
  ]);

  const logs = events
    .filter((event) => event.eventType === "run.log")
    .map((event) => RunLogDataSchema.parse(event.payload))
    .sort((left, right) => {
      const createdDelta = left.createdAt.localeCompare(right.createdAt);

      if (createdDelta !== 0) {
        return createdDelta;
      }

      const runDelta = left.runId.localeCompare(right.runId);

      if (runDelta !== 0) {
        return runDelta;
      }

      const stepDelta = (left.stepId ?? "").localeCompare(right.stepId ?? "");

      if (stepDelta !== 0) {
        return stepDelta;
      }

      const levelDelta = left.level.localeCompare(right.level);

      if (levelDelta !== 0) {
        return levelDelta;
      }

      return left.message.localeCompare(right.message);
    });

  return OutcomeThreadSnapshotSchema.parse({
    outcome: OutcomeSchema.parse(outcome),
    messages: messages.map((message) => MessageCreatedDataSchema.parse(message)),
    plans: planDetails,
    runs: runDetails,
    assistantMessages: buildAssistantMessageSnapshotsFromEvents(events),
    artifacts,
    logs,
    pendingApprovals: workspaceApprovals.filter(
      (approval) => approval.outcomeId === outcomeId
    ),
    presentationHints: buildOutcomePresentationHintsFromEvents(events)
  });
}

export function registerOutcomeRoutes(
  app: FastifyInstance,
  options: OutcomeRouteOptions
): void {
  app.post("/api/outcomes/start", async (request, reply) => {
    const parsed = StartOutcomeRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid outcome turn payload."));
    }

    try {
      const response = await options.outcomeTurnService.startThread(parsed.data);

      return reply.code(201).send(OutcomeTurnResponseSchema.parse(response));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("does not exist")) {
          return reply.code(404).send(badRequest(error.message));
        }
      }

      throw error;
    }
  });

  app.post("/api/outcomes", async (request, reply) => {
    const parsed = CreateOutcomeRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid outcome payload."));
    }

    const created = await options.repositories.outcomes.create({
      ...parsed.data,
      id: `outcome_${crypto.randomUUID()}`
    });

    options.eventBus.publish({
      outcomeId: created.id,
      type: "outcome.updated",
      data: created
    });

    return reply.code(201).send(OutcomeSchema.parse(created));
  });

  app.post("/api/outcomes/:id/continue", async (request, reply) => {
    const params = request.params as { id?: string };
    const parsed = ContinueOutcomeRequestSchema.safeParse(request.body);

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid outcome turn payload."));
    }

    try {
      const response = await options.outcomeTurnService.continueThread({
        outcomeId: params.id,
        ...parsed.data
      });

      return reply.code(201).send(OutcomeTurnResponseSchema.parse(response));
    } catch (error) {
      if (error instanceof Error) {
        if (error instanceof OutcomeTurnConflictError) {
          return reply.code(409).send(badRequest(error.message));
        }

        if (error instanceof OutcomeTurnReplayConflictError) {
          return reply.code(409).send(badRequest(error.message));
        }

        if (error.message.includes("not found")) {
          return reply.code(404).send(badRequest(error.message));
        }
      }

      throw error;
    }
  });

  app.get("/api/outcomes/:id", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    const outcome = await options.repositories.outcomes.getById(params.id);

    if (!outcome) {
      return reply.code(404).send(badRequest("Outcome not found."));
    }

    return reply.code(200).send(OutcomeSchema.parse(outcome));
  });

  app.get("/api/outcomes/:id/thread", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    const snapshot = await buildThreadSnapshot(options.repositories, params.id);

    if (!snapshot) {
      return reply.code(404).send(badRequest("Outcome not found."));
    }

    return reply.code(200).send(snapshot);
  });

  app.get("/api/outcomes/:id/messages", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    const outcome = await options.repositories.outcomes.getById(params.id);

    if (!outcome) {
      return reply.code(404).send(badRequest("Outcome not found."));
    }

    const messages = await options.repositories.outcomes.listMessages(params.id);

    return reply.code(200).send(
      OutcomeMessageListResponseSchema.parse({
        messages: messages.map((message) => MessageCreatedDataSchema.parse(message))
      })
    );
  });

  app.get("/api/outcomes", async (request, reply) => {
    const query = request.query as { workspaceId?: string };

    if (!query.workspaceId) {
      return reply.code(400).send(badRequest("workspaceId is required."));
    }

    const outcomes = await options.repositories.outcomes.listByWorkspace(
      query.workspaceId
    );

    return reply.code(200).send(
      OutcomeListResponseSchema.parse({
        outcomes: outcomes.map((outcome) => OutcomeSchema.parse(outcome))
      })
    );
  });

  app.post("/api/outcomes/:id/messages", async (request, reply) => {
    const params = request.params as { id?: string };
    const parsed = CreateOutcomeMessageRequestSchema.safeParse(request.body);

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid outcome message payload."));
    }

    const outcome = await options.repositories.outcomes.getById(params.id);

    if (!outcome) {
      return reply.code(404).send(badRequest("Outcome not found."));
    }

    const message = {
      ...parsed.data,
      id: `msg_${crypto.randomUUID()}`,
      outcomeId: params.id,
      submissionId: null,
      createdAt: new Date().toISOString()
    };

    await options.repositories.outcomes.appendMessage(message);

    options.eventBus.publish({
      outcomeId: params.id,
      type: "message.created",
      data: message
    });

    return reply.code(202).send({ accepted: true });
  });
}
