import { getDefaultWorkspaceId, getRunArtifacts, listApprovals } from "../../lib/api";
import { ReviewQueue } from "../../components/review/review-queue";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const workspaceId = getDefaultWorkspaceId();
  const approvals = await listApprovals(workspaceId);
  const uniqueRunIds = Array.from(new Set(approvals.map((approval) => approval.runId)));
  const artifactsByRunId = Object.fromEntries(
    await Promise.all(
      uniqueRunIds.map(async (runId) => [runId, await getRunArtifacts(runId)] as const)
    )
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Review
        </p>
        <h1 className="font-serif text-xl tracking-tight text-ink">
          Approval queue
        </h1>
        <p className="text-sm text-muted">
          Pending approvals across the workspace.
        </p>
      </div>

      <ReviewQueue
        workspaceId={workspaceId}
        initialApprovals={approvals}
        initialArtifactsByRunId={artifactsByRunId}
      />
    </main>
  );
}
