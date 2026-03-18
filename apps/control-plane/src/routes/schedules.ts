import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ScheduleDispatchModeSchema,
  ScheduleFireListResponseSchema,
  ScheduleListResponseSchema,
  ScheduleOutcomeModeSchema,
  ScheduleSchema,
  ScheduleStatusSchema,
  ScheduleTriggerSchema
} from "@computer-oss/protocol";
import type { ScheduleService } from "../lib/schedule-service";

const CreateScheduleRequestSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1),
  status: ScheduleStatusSchema.default("active"),
  trigger: ScheduleTriggerSchema,
  outcomeMode: ScheduleOutcomeModeSchema,
  dispatchMode: ScheduleDispatchModeSchema
});

const UpdateScheduleRequestSchema = z.object({
  title: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  status: ScheduleStatusSchema.optional(),
  trigger: ScheduleTriggerSchema.optional(),
  outcomeMode: ScheduleOutcomeModeSchema.optional(),
  dispatchMode: ScheduleDispatchModeSchema.optional()
});

type ScheduleRouteOptions = {
  scheduleService: ScheduleService;
};

function badRequest(message: string) {
  return { error: message };
}

export function registerScheduleRoutes(
  app: FastifyInstance,
  options: ScheduleRouteOptions
) {
  app.post("/api/workspaces/:workspaceId/schedules", async (request, reply) => {
    const params = request.params as { workspaceId?: string };
    const parsed = CreateScheduleRequestSchema.safeParse(request.body);

    if (!params.workspaceId) {
      return reply.code(400).send(badRequest("workspaceId is required."));
    }

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid schedule payload."));
    }

    const created = await options.scheduleService.createSchedule({
      workspaceId: params.workspaceId,
      ...parsed.data
    });

    return reply.code(201).send(ScheduleSchema.parse(created));
  });

  app.get("/api/workspaces/:workspaceId/schedules", async (request, reply) => {
    const params = request.params as { workspaceId?: string };

    if (!params.workspaceId) {
      return reply.code(400).send(badRequest("workspaceId is required."));
    }

    const schedules = await options.scheduleService.listSchedules(params.workspaceId);

    return reply.code(200).send(
      ScheduleListResponseSchema.parse({
        schedules: schedules.map((schedule) => ScheduleSchema.parse(schedule))
      })
    );
  });

  app.get("/api/schedules/:id", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Schedule id is required."));
    }

    const schedule = await options.scheduleService.getSchedule(params.id);

    if (!schedule) {
      return reply.code(404).send(badRequest("Schedule not found."));
    }

    return reply.code(200).send(ScheduleSchema.parse(schedule));
  });

  app.patch("/api/schedules/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const parsed = UpdateScheduleRequestSchema.safeParse(request.body);

    if (!params.id) {
      return reply.code(400).send(badRequest("Schedule id is required."));
    }

    if (!parsed.success) {
      return reply.code(400).send(badRequest("Invalid schedule payload."));
    }

    const updated = await options.scheduleService.updateSchedule(params.id, parsed.data);

    if (!updated) {
      return reply.code(404).send(badRequest("Schedule not found."));
    }

    return reply.code(200).send(ScheduleSchema.parse(updated));
  });

  app.delete("/api/schedules/:id", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Schedule id is required."));
    }

    try {
      const removed = await options.scheduleService.deleteSchedule(params.id);

      if (!removed) {
        return reply.code(404).send(badRequest("Schedule not found."));
      }

      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes("violates foreign key")) {
        return reply.code(409).send(badRequest(error.message));
      }

      throw error;
    }
  });

  app.get("/api/schedules/:id/fires", async (request, reply) => {
    const params = request.params as { id?: string };

    if (!params.id) {
      return reply.code(400).send(badRequest("Schedule id is required."));
    }

    const schedule = await options.scheduleService.getSchedule(params.id);

    if (!schedule) {
      return reply.code(404).send(badRequest("Schedule not found."));
    }

    const fires = await options.scheduleService.listScheduleFires(params.id);

    return reply.code(200).send(
      ScheduleFireListResponseSchema.parse({
        fires
      })
    );
  });
}
