import { getDefaultWorkspaceId, listApprovals } from "../../../lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId") ?? getDefaultWorkspaceId();
    const approvals = await listApprovals(workspaceId);

    return jsonResponse({
      approvals
    });
  } catch {
    return jsonResponse({ error: "Unable to load approvals." }, 502);
  }
}
