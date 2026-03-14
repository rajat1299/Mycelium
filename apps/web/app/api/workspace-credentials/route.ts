import { z } from "zod";
import { getControlPlaneBaseUrl } from "../../../lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CreateWorkspaceCredentialRequestSchema = z.object({
  workspaceId: z.string().min(1),
  providerId: z.string().min(1),
  label: z.string().min(1),
  secret: z.string().min(1)
});

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status
  });
}

export async function POST(request: Request) {
  try {
    const parsed = CreateWorkspaceCredentialRequestSchema.safeParse(
      await request.json()
    );

    if (!parsed.success) {
      return jsonResponse(
        { error: "Invalid workspace credential payload." },
        400
      );
    }

    const upstream = await fetch(
      `${getControlPlaneBaseUrl()}/api/workspace-credentials`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(parsed.data),
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
    return jsonResponse({ error: "Unable to create credential." }, 502);
  }
}
