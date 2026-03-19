import { z } from "zod";
import {
  ScheduleSchema,
} from "@computer-oss/protocol";
import { getControlPlaneBaseUrl, getDefaultWorkspaceId, listSchedules } from "../../../lib/api";

const ScheduleStatusFieldSchema = z.enum(["active", "paused", "disabled", "error"]);
const ScheduleOutcomeModeFieldSchema = z.enum([
  "create_outcome",
  "continue_outcome"
]);
const ScheduleDispatchModeFieldSchema = z.enum([
  "outcome_only",
  "draft_plan",
  "create_run"
]);
const ScheduleTriggerFieldSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("cron"),
    expression: z.string().min(1),
    timezone: z.string().min(1)
  }),
  z.object({
    kind: z.literal("every"),
    everyMs: z.number().int().positive(),
    anchorAt: z.string().datetime().optional(),
    timezone: z.string().min(1).optional()
  }),
  z.object({
    kind: z.literal("at"),
    at: z.string().datetime(),
    timezone: z.string().min(1).optional()
  })
]);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CreateScheduleRequestSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1),
  status: ScheduleStatusFieldSchema.optional(),
  trigger: ScheduleTriggerFieldSchema,
  outcomeMode: ScheduleOutcomeModeFieldSchema,
  dispatchMode: ScheduleDispatchModeFieldSchema
});

const UpdateScheduleRequestSchema = z.object({
  workspaceId: z.string().min(1),
  scheduleId: z.string().min(1),
  title: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  status: ScheduleStatusFieldSchema.optional(),
  trigger: ScheduleTriggerFieldSchema.optional(),
  outcomeMode: ScheduleOutcomeModeFieldSchema.optional(),
  dispatchMode: ScheduleDispatchModeFieldSchema.optional()
});

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId") ?? getDefaultWorkspaceId();
    const schedules = await listSchedules(workspaceId);
    return jsonResponse({ schedules });
  } catch {
    return jsonResponse({ error: "Unable to load schedules." }, 502);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = CreateScheduleRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonResponse({ error: "Invalid schedule payload." }, 400);
    }

    const { workspaceId, ...body } = parsed.data;
    const upstream = await fetch(
      `${getControlPlaneBaseUrl()}/api/workspaces/${encodeURIComponent(workspaceId)}/schedules`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(body),
        cache: "no-store"
      }
    );
    const payload = await upstream.text();

    return new Response(payload, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json; charset=utf-8"
      }
    });
  } catch {
    return jsonResponse({ error: "Unable to create schedule." }, 502);
  }
}

export async function PATCH(request: Request) {
  try {
    const parsed = UpdateScheduleRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonResponse({ error: "Invalid schedule payload." }, 400);
    }

    const { scheduleId, workspaceId: _workspaceId, ...body } = parsed.data;
    const upstream = await fetch(
      `${getControlPlaneBaseUrl()}/api/schedules/${encodeURIComponent(scheduleId)}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(body),
        cache: "no-store"
      }
    );
    const payload = await upstream.text();

    return new Response(payload, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json; charset=utf-8"
      }
    });
  } catch {
    return jsonResponse({ error: "Unable to update schedule." }, 502);
  }
}
