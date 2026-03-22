import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { FollowUpInput } from "../../../components/outcomes/follow-up-input";
import { OutcomeConversation } from "../../../components/outcomes/outcome-conversation";
import { TasksPane } from "../../../components/outcomes/tasks-pane";
import {
  createOutcomeMessage,
  getLatestRun,
  listOutcomes,
  listApprovals,
  getOutcome,
  getPlan,
  getRunArtifacts,
  getRunAssistantMessages,
  getRunLogs,
  getRun
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

  const outcomesPromise = listOutcomes(outcome.workspaceId);
  const approvalsPromise = listApprovals(outcome.workspaceId);
  const [artifacts, logs, assistantMessages, approvals, outcomes] = run
    ? await Promise.all([
        getRunArtifacts(run.id),
        getRunLogs(run.id),
        getRunAssistantMessages(run.id),
        approvalsPromise,
        outcomesPromise
      ])
    : [
        [],
        [],
        [],
        await approvalsPromise,
        await outcomesPromise
      ];
  const pendingApprovalsForRun = run
    ? approvals.filter((approval) => approval.runId === run.id)
    : [];
  const workspaceOutcomes = [
    ...(outcomes.some((candidate) => candidate.id === outcome.id)
      ? outcomes
      : [outcome, ...outcomes])
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const outcomeTitle = deriveOutcomeTitle(outcome.prompt);

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

          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-panel-line/70 bg-surface-elevated/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {outcome.status}
            </span>
            {run ? (
              <span className="rounded-full border border-panel-line/70 bg-surface-elevated/70 px-3 py-1 text-[11px] font-semibold text-muted">
                {run.steps.length} {run.steps.length === 1 ? "step" : "steps"}
              </span>
            ) : null}
          </div>
        </header>

        {/* ── Execution Feed ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth px-4 pb-44 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl space-y-6 py-6">
            {bootstrapState === "plan" ? (
              <p className="rounded-xl border border-amber-300/40 bg-amber-50/40 px-4 py-3 text-sm text-amber-800">
                Automatic plan generation failed before execution began.
              </p>
            ) : null}

            {bootstrapState === "run" ? (
              <p className="rounded-xl border border-amber-300/40 bg-amber-50/40 px-4 py-3 text-sm text-amber-800">
                Automatic run start failed before execution began.
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
              initialAssistantMessages={assistantMessages}
              initialPendingApprovals={pendingApprovalsForRun}
            />
          </div>
        </div>

        {/* ── Sticky follow-up input with gradient fade ───────────── */}
        <FollowUpInput action={appendMessageAction} hasConversation={Boolean(run)} />
      </section>
    </main>
  );
}
