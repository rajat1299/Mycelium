import { getCheckpoint } from "../../../../lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ checkpointId: string }> }
) {
  try {
    const { checkpointId } = await context.params;
    const checkpoint = await getCheckpoint(checkpointId);

    if (!checkpoint) {
      return jsonResponse({ error: "Checkpoint not found." }, 404);
    }

    return jsonResponse(checkpoint);
  } catch {
    return jsonResponse({ error: "Unable to load checkpoint detail." }, 502);
  }
}
