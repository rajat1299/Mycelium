import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { ExecutionConsole } from "../../../components/outcomes/execution-console";
import { FollowUpInput } from "../../../components/outcomes/follow-up-input";
import { OutcomeActivity } from "../../../components/outcomes/outcome-activity";
import { OutcomeConversation } from "../../../components/outcomes/outcome-conversation";
import { PlanActions } from "../../../components/outcomes/plan-actions";
import { PlanGraph } from "../../../components/outcomes/plan-graph";
import { TasksPane } from "../../../components/outcomes/tasks-pane";
import {
  createOutcomeMessage,
  createPlan,
  createRun,
  getCheckpoint,
  getOutcomeMessageHistory,
  getRunArtifactLineage,
  getRunAudit,
  getLatestRun,
  listOutcomes,
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
import { deriveOutcomeTitle } from "../../../lib/outcome-title";

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
  searchParams: Promise<{ runId?: string | string[]; bootstrap?: string | string[] }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const runIdParam = resolvedSearchParams.runId;
  const bootstrapParam = resolvedSearchParams.bootstrap;
  const selectedRunId =
    typeof runIdParam === "string" ? runIdParam : runIdParam?.[0];
  const bootstrapState =
    typeof bootstrapParam === "string" ? bootstrapParam : bootstrapParam?.[0] ?? null;
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
  const outcomesPromise = listOutcomes(outcome.workspaceId);
  const authProfilesPromise = listAuthProfiles(outcome.workspaceId);
  const approvalsPromise = listApprovals(outcome.workspaceId);
  const workersPromise = listWorkers(outcome.workspaceId);
  const checkpointsPromise = run ? getRunCheckpoints(run.id) : Promise.resolve([]);
  const [
    artifacts,
    logs,
    authProfiles,
    lineageEdges,
    approvals,
    checkpoints,
    auditEvents,
    workers,
    messageHistory,
    outcomes
  ] = run
    ? await Promise.all([
        getRunArtifacts(run.id),
        getRunLogs(run.id),
        authProfilesPromise,
        getRunArtifactLineage(run.id),
        approvalsPromise,
        checkpointsPromise,
        getRunAudit(run.id),
        workersPromise,
        messageHistoryPromise,
        outcomesPromise
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
        await messageHistoryPromise,
        await outcomesPromise
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
  const workspaceOutcomes = [
    ...(outcomes.some((candidate) => candidate.id === outcome.id)
      ? outcomes
      : [outcome, ...outcomes])
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const outcomeTitle = deriveOutcomeTitle(outcome.prompt);

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

  async function appendMessageAction(formData: FormData) {
    "use server";

    const content = String(formData.get("content") ?? "").trim();

    if (!content) {
      return;
    }

    await createOutcomeMessage(id, {
      role: "user",
      content
    });

    revalidatePath(`/outcomes/${id}`);
  }

  return (
    <main className="flex min-h-screen min-w-0 flex-1 overflow-hidden bg-shell">
      <TasksPane outcomes={workspaceOutcomes} selectedOutcomeId={outcome.id} />

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-panel-line bg-shell/92 px-6 py-4 backdrop-blur xl:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <h1 className="truncate text-[1.4rem] font-semibold tracking-tight text-ink xl:text-[1.55rem]">
                {outcomeTitle}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full border border-panel-line px-2.5 py-1">
                  {outcome.status}
                </span>
                <span className="rounded-full border border-panel-line px-2.5 py-1">
                  {outcome.source}
                </span>
                <span>{new Date(outcome.updatedAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {artifacts.length > 0 ? (
                <div className="rounded-full border border-panel-line px-3 py-2 text-sm font-medium text-muted">
                  {artifacts.length}
                </div>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-panel-line bg-panel px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
              >
                Todo
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-panel-line bg-panel px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
              >
                Share
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8 px-5 py-8 lg:px-8 xl:px-10">
            {bootstrapState === "plan" ? (
              <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950 shadow-panel">
                Automatic plan generation failed after creating the task. Retry from
                operator details below.
              </section>
            ) : null}

            {bootstrapState === "run" ? (
              <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950 shadow-panel">
                Automatic run start failed after creating the task. You can restart
                it from operator details below.
              </section>
            ) : null}

            <OutcomeConversation
              outcomeId={outcome.id}
              outcomePrompt={outcome.prompt}
              outcomeSource={outcome.source}
              initialPlan={plan}
              initialRun={run}
              initialArtifacts={artifacts}
              initialLogs={logs}
              initialPendingApprovals={pendingApprovalsForRun}
            />

            <details className="rounded-[1.7rem] border border-panel-line bg-panel/92 shadow-panel">
              <summary className="cursor-pointer list-none px-6 py-5 text-sm font-semibold tracking-[0.02em] text-ink marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  <span>Operator details</span>
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    checkpoints, audit, lineage, recovery
                  </span>
                </span>
              </summary>

              <div className="space-y-8 border-t border-panel-line px-6 py-6">
                {!plan || !run ? (
                  <PlanActions
                    planId={plan?.id ?? null}
                    hasRun={Boolean(run)}
                    createPlanAction={createPlanAction}
                    startRunAction={startRunAction}
                  />
                ) : null}
                <PlanGraph outcomeId={outcome.id} initialPlan={plan} />
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
            </details>
          </div>
        </div>

        <FollowUpInput action={appendMessageAction} />
      </section>
    </main>
  );
}
