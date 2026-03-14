import type { FastifyInstance } from "fastify";
import {
  CapabilityFamilySchema,
  CreateRunRequestSchema,
  RunDetailSchema,
  RunLogDataSchema,
  RunLogListResponseSchema,
  RunSchema,
  RunStepSchema
} from "@computer-oss/protocol";
import type { EventBus } from "../lib/event-bus";
import type { ExecutionService } from "../lib/execution-service";
import type { Repositories } from "../lib/repositories";
import type { RouterService } from "../lib/router-service";

type RunRouteOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  executionService: ExecutionService;
  routerService: RouterService;
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

async function buildRunDetail(
  repositories: Repositories,
  run: Awaited<ReturnType<Repositories["runs"]["getById"]>>
): Promise<ReturnType<typeof RunDetailSchema.parse> | null> {
  if (!run) {
    return null;
  }

  const steps = await repositories.runs.listSteps(run.id);

  return RunDetailSchema.parse({
    ...run,
    steps
  });
}

async function resolveAndPersistStepRoutes(
  options: RunRouteOptions,
  input: {
    workspaceId: string;
    runId: string;
    resolvedAt: string;
  }
) {
  const steps = await options.repositories.runs.listSteps(input.runId);

  await Promise.all(
    steps.map(async (step) => {
      const route = await options.routerService.resolveRoute({
        workspaceId: input.workspaceId,
        capability: CapabilityFamilySchema.parse(step.capability),
        resolvedAt: input.resolvedAt
      });

      const updated = await options.repositories.runs.updateStepRoute({
        stepId: step.id,
        route
      });

      if (!updated) {
        throw new Error(`Step ${step.id} disappeared during route persistence.`);
      }
    })
  );
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
    let run;

    try {
      run = await options.repositories.runs.createFromPlan({
        id: `run_${crypto.randomUUID()}`,
        outcomeId: outcome.id,
        planId: parsed.data.planId,
        createdAt: now,
        updatedAt: now
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("does not exist")) {
          return reply.code(404).send(badRequest(error.message));
        }

        if (error.message.includes("belongs to")) {
          return reply.code(409).send(badRequest(error.message));
        }
      }

      throw error;
    }

    await resolveAndPersistStepRoutes(options, {
      workspaceId: outcome.workspaceId,
      runId: run.id,
      resolvedAt: now
    });

    const updatedOutcome = await options.repositories.outcomes.updateStatus({
      id: outcome.id,
      status: "queued",
      updatedAt: now
    });

    if (!updatedOutcome) {
      return reply.code(500).send(badRequest("Failed to update outcome status."));
    }

    const response = await buildRunResponse(options.repositories, run.id);

    if (!response) {
      return reply.code(500).send(badRequest("Failed to read persisted run."));
    }

    options.eventBus.publish({
      outcomeId: outcome.id,
      type: "outcome.updated",
      data: updatedOutcome
    });

    const runEventData = RunSchema.parse({
      id: response.id,
      outcomeId: response.outcomeId,
      planId: response.planId,
      status: response.status,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt
    });

    await options.repositories.runs.appendEvent({
      id: `event_${crypto.randomUUID()}`,
      runId: response.id,
      eventType: "run.created",
      payload: runEventData,
      createdAt: now
    });

    options.eventBus.publish({
      outcomeId: outcome.id,
      type: "run.created",
      data: runEventData
    });

    for (const step of response.steps) {
      const stepEventData = RunStepSchema.parse(step);

      await options.repositories.runs.appendEvent({
        id: `event_${crypto.randomUUID()}`,
        runId: response.id,
        eventType: "run.step.updated",
        payload: stepEventData,
        createdAt: step.updatedAt
      });

      options.eventBus.publish({
        outcomeId: outcome.id,
        type: "run.step.updated",
        data: stepEventData
      });
    }

    options.executionService.startRun(response.id);

    return reply.code(201).send(response);
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
}
