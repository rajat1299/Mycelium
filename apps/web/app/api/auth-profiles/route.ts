import { z } from "zod";
import { getControlPlaneBaseUrl } from "../../../lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CreateAuthProfileRequestSchema = z.object({
  workspaceId: z.string().min(1),
  providerId: z.string().min(1),
  label: z.string().min(1),
  credentialId: z.string().min(1),
  priority: z.number().int().nonnegative(),
  status: z.enum(["active", "disabled", "cooling_down"]).optional(),
  cooldownUntil: z.string().datetime().nullable().optional()
});

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status
  });
}

export async function POST(request: Request) {
  try {
    const parsed = CreateAuthProfileRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonResponse({ error: "Invalid auth profile payload." }, 400);
    }

    const upstream = await fetch(`${getControlPlaneBaseUrl()}/api/auth-profiles`, {
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
  } catch {
    return jsonResponse({ error: "Unable to create auth profile." }, 502);
  }
}
