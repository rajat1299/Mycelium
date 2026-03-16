import Link from "next/link";
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
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-10">
      <header className="grid gap-4 border-b border-panel-line pb-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent">
            Review queue
          </p>
          <h1 className="max-w-3xl font-serif text-4xl tracking-tight text-ink sm:text-5xl">
            Operator review desk
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            Pending approvals across the workspace resolve here before blocked runs
            can complete or fail.
          </p>
        </div>
        <div className="rounded-3xl border border-panel-line bg-panel p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Active workspace
          </p>
          <p className="mt-4 text-lg font-semibold text-ink">{workspaceId}</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full border border-panel-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent hover:text-accent"
          >
            Back to outcomes
          </Link>
        </div>
      </header>

      <ReviewQueue
        workspaceId={workspaceId}
        initialApprovals={approvals}
        initialArtifactsByRunId={artifactsByRunId}
      />
    </main>
  );
}
