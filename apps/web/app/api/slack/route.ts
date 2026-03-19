import { z } from "zod";
import { getControlPlaneBaseUrl } from "../../../lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UpsertConnectionRequestSchema = z.object({
  workspaceId: z.string().min(1),
  enabled: z.boolean(),
  accountLabel: z.string().min(1),
  externalWorkspaceId: z.string().min(1),
  externalWorkspaceLabel: z.string().min(1).nullable().optional()
});

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, { status });
}

export async function PUT(request: Request) {
  try {
    const parsed = UpsertConnectionRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonResponse({ error: "Invalid Slack connection payload." }, 400);
    }

    const { workspaceId, ...body } = parsed.data;
    const upstream = await fetch(
      `${getControlPlaneBaseUrl()}/api/workspaces/${encodeURIComponent(workspaceId)}/slack/connection`,
      {
        method: "PUT",
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
    return jsonResponse({ error: "Unable to save Slack connection." }, 502);
  }
}
