import { z } from "zod";
import { getControlPlaneBaseUrl } from "../../../../../lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ApprovalResolutionRequestSchema = z.object({
  resolutionNote: z.string().min(1).nullable().optional()
});

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const parsed = ApprovalResolutionRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonResponse({ error: "Invalid approval resolution payload." }, 400);
    }

    const upstream = await fetch(`${getControlPlaneBaseUrl()}/api/approvals/${id}/reject`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        resolutionNote: parsed.data.resolutionNote ?? null
      }),
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
  } catch {
    return jsonResponse({ error: "Unable to reject pending review." }, 502);
  }
}
