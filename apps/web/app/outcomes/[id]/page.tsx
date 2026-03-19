import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { ExecutionConsole } from "../../../components/outcomes/execution-console";
import { OutcomeActivity } from "../../../components/outcomes/outcome-activity";
import { PlanActions } from "../../../components/outcomes/plan-actions";
import { PlanGraph } from "../../../components/outcomes/plan-graph";
import {
  createPlan,
  createRun,
  getCheckpoint,
  getOutcomeMessageHistory,
  getRunArtifactLineage,
  getRunAudit,
  getLatestRun,
  listAuthProfiles,
  listApprovals,
  getOutcome,
  getPlan,
  getRunCheckpoints,
  getRunArtifacts,
  getRunLogs,
  getRun,
  listWorkers
} from "../../../lib/api";

export const dynamic = "force-dynamic";

async function resolveRunForOutcome(outcomeId: string, requestedRunId?: string) {
  if (!requestedRunId) {
    return getLatestRun(outcomeId);
  }

  const requestedRun = await getRun(requestedRunId);

  if (requestedRun?.outcomeId === outcomeId) {
    return requestedRun;
  }

  return getLatestRun(outcomeId);
}

export default async function OutcomeDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ runId?: string | string[] }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const runIdParam = resolvedSearchParams.runId;
  const selectedRunId =
    typeof runIdParam === "string" ? runIdParam : runIdParam?.[0];
  const [outcome, plan, run] = await Promise.all([
    getOutcome(id),
    getPlan(id),
    resolveRunForOutcome(id, selectedRunId)
  ]);

  if (!outcome) {
    notFound();
  }

  const messageHistoryPromise =
    outcome.source === "slack" || outcome.source === "telegram"
      ? getOutcomeMessageHistory(outcome.id)
      : Promise.resolve(null);
  const authProfilesPromise = listAuthProfiles(outcome.workspaceId);
  const approvalsPromise = listApprovals(outcome.workspaceId);
  const workersPromise = listWorkers(outcome.workspaceId);
  const checkpointsPromise = run ? getRunCheckpoints(run.id) : Promise.resolve([]);
  const [artifacts, logs, authProfiles, lineageEdges, approvals, checkpoints, auditEvents, workers, messageHistory] = run
    ? await Promise.all([
        getRunArtifacts(run.id),
        getRunLogs(run.id),
        authProfilesPromise,
        getRunArtifactLineage(run.id),
        approvalsPromise,
        checkpointsPromise,
        getRunAudit(run.id),
        workersPromise,
        messageHistoryPromise
      ])
    : [
        [],
        [],
        await authProfilesPromise,
        [],
        await approvalsPromise,
        [],
        [],
        await workersPromise,
        await messageHistoryPromise
      ];
  const pendingApprovalsForRun = run
    ? approvals.filter((approval) => approval.runId === run.id)
    : [];
  const selectedCheckpointId =
    run?.latestCheckpointId ??
    [...checkpoints]
      .sort((left, right) => right.sequence - left.sequence)[0]
      ?.id ??
    null;
  const selectedCheckpoint = selectedCheckpointId
    ? await getCheckpoint(selectedCheckpointId)
    : null;

  async function createPlanAction() {
    "use server";

    await createPlan(id);
    revalidatePath(`/outcomes/${id}`);
    redirect(`/outcomes/${id}`);
  }

  async function startRunAction(formData: FormData) {
    "use server";

    const planId = String(formData.get("planId") ?? "").trim();

    if (!planId) {
      return;
    }

    const createdRun = await createRun(id, { planId });

    revalidatePath(`/outcomes/${id}`);
    redirect(`/outcomes/${id}?runId=${createdRun.id}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Outcome
        </p>
        <h1 className="max-w-3xl font-serif text-2xl tracking-tight text-ink">
          {outcome.prompt}
        </h1>
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          <span>{outcome.status}</span>
          <span>{outcome.source}</span>
          <span>{new Date(outcome.updatedAt).toLocaleString()}</span>
        </div>
      </div>

      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <article className="rounded-3xl border border-panel-line bg-panel p-6 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              Current brief
            </p>
            <p className="mt-4 text-base leading-7 text-ink">{outcome.prompt}</p>
          </article>
          <PlanActions
            planId={plan?.id ?? null}
            hasRun={Boolean(run)}
            createPlanAction={createPlanAction}
            startRunAction={startRunAction}
          />
          <PlanGraph outcomeId={outcome.id} initialPlan={plan} />
        </div>

        <div className="space-y-8">
          <ExecutionConsole
            outcomeId={outcome.id}
            outcomeSource={outcome.source}
            initialRun={run}
            initialArtifacts={artifacts}
            initialLogs={logs}
            initialPendingApprovals={pendingApprovalsForRun}
            initialLineageEdges={lineageEdges}
            initialAuthProfiles={authProfiles}
            initialWorkers={workers}
            initialCheckpoints={checkpoints}
            initialSelectedCheckpoint={selectedCheckpoint}
            initialAuditEvents={auditEvents}
            initialMessageHistory={messageHistory}
          />
          <OutcomeActivity outcome={outcome} />
        </div>
      </section>
    </main>
  );
}
