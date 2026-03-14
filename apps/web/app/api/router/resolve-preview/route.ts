import { RoutePreviewRequestSchema } from "@computer-oss/protocol";
import { getControlPlaneBaseUrl } from "../../../../lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status
  });
}

export async function POST(request: Request) {
  try {
    const parsed = RoutePreviewRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonResponse({ error: "Invalid route preview payload." }, 400);
    }

    const upstream = await fetch(
      `${getControlPlaneBaseUrl()}/api/router/resolve-preview`,
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
    return jsonResponse({ error: "Unable to preview route." }, 502);
  }
}
