import { z } from "zod";
import { getControlPlaneBaseUrl } from "../../../../../lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ResumeRunRequestSchema = z.object({
  checkpointId: z.string().min(1).optional()
});

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await context.params;
    const parsed = ResumeRunRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonResponse({ error: "Invalid resume payload." }, 400);
    }

    const upstream = await fetch(`${getControlPlaneBaseUrl()}/api/runs/${runId}/resume`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store"
    });
    const payload = await upstream.text();

    return new Response(payload, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : "Unable to resume interrupted run."
      },
      502
    );
  }
}
