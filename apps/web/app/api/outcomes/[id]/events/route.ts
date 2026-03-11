import { getControlPlaneEventUrl } from "../../../../../lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const upstream = await fetch(getControlPlaneEventUrl(id), {
      cache: "no-store",
      headers: {
        accept: "text/event-stream"
      }
    });

    if (!upstream.ok || !upstream.body) {
      return new Response("Unable to connect to outcome stream.", {
        status: upstream.status || 502,
        headers: {
          "content-type": "text/plain; charset=utf-8"
        }
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive"
      }
    });
  } catch {
    return new Response("Unable to connect to outcome stream.", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }
}
