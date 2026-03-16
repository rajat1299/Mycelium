import { getRunAudit } from "../../../../../lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await context.params;
    const events = await getRunAudit(runId);

    return jsonResponse({
      events
    });
  } catch {
    return jsonResponse({ error: "Unable to load run audit history." }, 502);
  }
}
