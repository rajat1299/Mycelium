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

      <section className="relative flex min-w-0 flex-1 flex-col max-h-screen">
        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="sticky top-0 shrink-0 flex items-center justify-between gap-4 border-b border-panel-line/50 bg-shell/80 px-6 py-3 backdrop-blur-xl z-20">
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <h2 className="truncate text-sm font-semibold text-ink [text-wrap:balance]">
              {outcomeTitle}
            </h2>
            {(outcome.status === "running" || outcome.status === "planning") && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span
                  className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-accent opacity-75"
                  style={{ animation: "ping-slow 2s cubic-bezier(0,0,0.2,1) infinite" }}
                />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Overflow menu */}
            <button type="button" className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-elevated hover:text-ink" aria-label="More options">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
            </button>
            {/* Todo / step count */}
            <button type="button" className="flex items-center gap-1.5 rounded-lg p-2 text-muted transition-colors hover:bg-surface-elevated hover:text-ink" aria-label="Subtasks">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="m9 15 2 2 4-4" /></svg>
              {run && run.steps.length > 0 && (
                <span className="text-xs font-semibold tabular-nums">{run.steps.length}</span>
              )}
            </button>
            {/* Share button */}
            <button type="button" className="ml-1 flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 text-xs font-semibold text-shell transition-all duration-150 hover:opacity-90 active:scale-[0.97]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Share
            </button>
          </div>
        </header>

        {/* ── Execution Feed ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth px-4 pb-44 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl space-y-6 py-6">
            {bootstrapState === "plan" ? (
              <p className="rounded-xl border border-amber-300/40 bg-amber-50/40 px-4 py-3 text-sm text-amber-800">
                Automatic plan generation failed. Retry from operator details below.
              </p>
            ) : null}

            {bootstrapState === "run" ? (
              <p className="rounded-xl border border-amber-300/40 bg-amber-50/40 px-4 py-3 text-sm text-amber-800">
                Automatic run start failed. Restart from operator details below.
              </p>
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

            <details className="rounded-xl border border-panel-line/60 bg-surface-elevated/30">
              <summary className="cursor-pointer list-none px-5 py-3.5 text-xs font-medium tracking-wide text-muted marker:hidden">
                <span className="flex items-center gap-2">
                  <span>Operator details</span>
                  <span className="text-[10px] text-muted/50">
                    checkpoints / audit / lineage
                  </span>
                </span>
              </summary>

              <div className="space-y-6 border-t border-panel-line/60 px-5 py-5">
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

        {/* ── Sticky follow-up input with gradient fade ───────────── */}
        <FollowUpInput action={appendMessageAction} hasConversation={Boolean(run)} />
      </section>
    </main>
  );
}
