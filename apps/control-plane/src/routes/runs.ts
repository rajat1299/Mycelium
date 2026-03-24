import type { FastifyInstance } from "fastify";
import {
  AssistantMessageCompletedDataSchema,
  AssistantMessageDeltaDataSchema,
  AssistantMessageListResponseSchema,
  AssistantMessageSnapshotSchema,
  AssistantMessageStartedDataSchema,
  ResumeRunRequestSchema,
  ResumeRunResponseSchema,
  CreateRunRequestSchema,
  RunDetailSchema,
  RunLogDataSchema,
  RunLogListResponseSchema
} from "@computer-oss/protocol";
import type { EventBus } from "../lib/event-bus";
import type { ExecutionService } from "../lib/execution-service";
import { createQueuedRunFromPlan } from "../lib/outcome-turn-service";
import type { Repositories } from "../lib/repositories";
import type { RouterService } from "../lib/router-service";
import type { SimulatedExecutionService } from "../lib/simulated-execution";

type RunRouteOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  executionService: ExecutionService;
  simulatedExecutionService: SimulatedExecutionService;
  routerService: RouterService;
  simulationMode?: boolean;
};

function badRequest(message: string) {
  return {
    error: message
  };
}

async function buildRunResponse(
  repositories: Repositories,
  runId: string
): Promise<ReturnType<typeof RunDetailSchema.parse> | null> {
  const run = await repositories.runs.getById(runId);

  return buildRunDetail(repositories, run);
}

async function buildAssistantMessageSnapshots(
  repositories: Repositories,
  runId: string
) {
  const events = await repositories.runs.listEvents(runId);
  const messages = new Map<string, ReturnType<typeof AssistantMessageSnapshotSchema.parse>>();

  for (const event of events) {
    switch (event.eventType) {
      case "assistant.message.started": {
        const data = AssistantMessageStartedDataSchema.parse(event.payload);
        const existing = messages.get(data.messageId);

        messages.set(
          data.messageId,
          AssistantMessageSnapshotSchema.parse({
            id: data.messageId,
            runId: data.runId,
            kind: data.kind,
            content: existing?.content ?? "",
            createdAt: data.createdAt,
            updatedAt: existing?.updatedAt ?? data.createdAt,
            status: existing?.status ?? "streaming"
          })
        );
        break;
      }
      case "assistant.message.delta": {
        const data = AssistantMessageDeltaDataSchema.parse(event.payload);
        const existing = messages.get(data.messageId);

        messages.set(
          data.messageId,
          AssistantMessageSnapshotSchema.parse({
            id: data.messageId,
            runId: data.runId,
            kind: data.kind,
            content: data.content,
            createdAt: existing?.createdAt ?? data.createdAt,
            updatedAt: data.updatedAt,
            status: existing?.status === "completed" ? "completed" : "streaming"
          })
        );
        break;
      }
      case "assistant.message.completed": {
        const data = AssistantMessageCompletedDataSchema.parse(event.payload);

        messages.set(
          data.messageId,
          AssistantMessageSnapshotSchema.parse({
            id: data.messageId,
            runId: data.runId,
            kind: data.kind,
            content: data.content,
            createdAt: data.createdAt,
            updatedAt: data.completedAt,
            status: "completed"
          })
        );
        break;
      }
      default:
        break;
    }
  }

  return Array.from(messages.values()).sort((left, right) => {
    const createdDelta = left.createdAt.localeCompare(right.createdAt);

    if (createdDelta !== 0) {
      return createdDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

async function buildRunDetail(
  repositories: Repositories,
  run: Awaited<ReturnType<Repositories["runs"]["getById"]>>
): Promise<ReturnType<typeof RunDetailSchema.parse> | null> {
  if (!run) {
    return null;
  }

  const steps = [...(await repositories.runs.listSteps(run.id))].sort(
    (left, right) => left.position - right.position
  );

  return RunDetailSchema.parse({
    ...run,
    steps
  });
}

export function registerRunRoutes(
  app: FastifyInstance,
  options: RunRouteOptions
): void {
  app.post("/api/outcomes/:id/runs", async (request, reply) => {
    const params = request.params as { id?: string };
    const parsed = CreateRunRequestSchema.safeParse(request.body);

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid run payload."));
    }

    const outcome = await options.repositories.outcomes.getById(params.id);

    if (!outcome) {
      return reply.code(404).send(badRequest("Outcome not found."));
    }

    const now = new Date().toISOString();
    const plan = await options.repositories.plans.getById(parsed.data.planId);

    if (!plan) {
      return reply.code(404).send(badRequest(`Plan ${parsed.data.planId} does not exist.`));
    }

    const runStartOptions = {
      repositories: options.repositories,
      eventBus: options.eventBus,
      executionService: options.executionService,
      simulatedExecutionService: options.simulatedExecutionService,
      routerService: options.routerService,
      simulationMode: options.simulationMode,
      now: () => new Date(now),
      idFactory: () => crypto.randomUUID()
    };

    try {
      const startedRun = await createQueuedRunFromPlan(runStartOptions, {
        outcome,
        planId: parsed.data.planId,
        triggerMessageId: plan.triggerMessageId,
        createdAt: now
      });

      return reply.code(201).send(startedRun.run);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("does not exist") || error.message.includes("not found")) {
          return reply.code(404).send(badRequest(error.message));
        }

        if (error.message.includes("belongs to")) {
          return reply.code(409).send(badRequest(error.message));
        }
      }

      throw error;
    }
  });

  app.get("/api/outcomes/:id/runs/latest", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Outcome id is required."));
    }

    const outcome = await options.repositories.outcomes.getById(params.id);

    if (!outcome) {
      return reply.code(404).send(badRequest("Outcome not found."));
    }

    const run = await options.repositories.runs.getLatestByOutcome(params.id);
    const response = await buildRunDetail(options.repositories, run);

    if (!response) {
      return reply.code(404).send(badRequest("Run not found."));
    }

    return reply.code(200).send(response);
  });

  app.get("/api/runs/:runId", async (request, reply) => {
    const params = request.params as { runId?: string };

    if (!params.runId) {
      return reply.code(400).send(badRequest("Run id is required."));
    }

    const response = await buildRunResponse(options.repositories, params.runId);

    if (!response) {
      return reply.code(404).send(badRequest("Run not found."));
    }

    return reply.code(200).send(response);
  });

  app.get("/api/runs/:runId/logs", async (request, reply) => {
    const params = request.params as { runId?: string };

    if (!params.runId) {
      return reply.code(400).send(badRequest("Run id is required."));
    }

    const run = await options.repositories.runs.getById(params.runId);

    if (!run) {
      return reply.code(404).send(badRequest("Run not found."));
    }

    const events = await options.repositories.runs.listEvents(
      params.runId,
      "run.log"
    );
    const logs = events.map((event) => RunLogDataSchema.parse(event.payload));

    return reply.code(200).send(
      RunLogListResponseSchema.parse({
        logs
      })
    );
  });

  app.get("/api/runs/:runId/assistant-messages", async (request, reply) => {
    const params = request.params as { runId?: string };

    if (!params.runId) {
      return reply.code(400).send(badRequest("Run id is required."));
    }

    const run = await options.repositories.runs.getById(params.runId);

    if (!run) {
      return reply.code(404).send(badRequest("Run not found."));
    }

    const assistantMessages = await buildAssistantMessageSnapshots(
      options.repositories,
      params.runId
    );

    return reply.code(200).send(
      AssistantMessageListResponseSchema.parse({
        assistantMessages
      })
    );
  });

  app.post("/api/runs/:runId/resume", async (request, reply) => {
    const params = request.params as { runId?: string };
    const parsed = ResumeRunRequestSchema.safeParse(request.body ?? {});

    if (!params.runId) {
      return reply.code(400).send(badRequest("Run id is required."));
    }

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid resume payload."));
    }

    const run = await options.repositories.runs.getById(params.runId);

    if (!run) {
      return reply.code(404).send(badRequest("Run not found."));
    }

    try {
      const resumed = await options.executionService.resumeRun({
        runId: params.runId,
        checkpointId: parsed.data.checkpointId
      });

      if (!resumed) {
        return reply.code(404).send(badRequest("Run not found."));
      }

      return reply.code(200).send(ResumeRunResponseSchema.parse(resumed));
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("cannot be resumed") ||
          error.message.includes("does not exist") ||
          error.message.includes("belongs to") ||
          error.message.includes("resumable checkpoint") ||
          error.message.includes("not resumable"))
      ) {
        return reply
          .code(error.message.includes("does not exist") ? 404 : 409)
          .send(badRequest(error.message));
      }

      throw error;
    }
  });
}
