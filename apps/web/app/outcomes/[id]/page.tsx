import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { FollowUpInput } from "../../../components/outcomes/follow-up-input";
import { OutcomeConversation } from "../../../components/outcomes/outcome-conversation";
import { TasksPane } from "../../../components/outcomes/tasks-pane";
import {
  continueOutcome,
  getOutcomeThreadSnapshot,
  listOutcomes,
  OutcomeContinueConflictError,
} from "../../../lib/api";
import { deriveOutcomeTitle } from "../../../lib/outcome-title";

export const dynamic = "force-dynamic";

const ACTIVE_OUTCOME_STATUSES = new Set([
  "planning",
  "queued",
  "running",
  "blocked_on_approval"
]);

function isActiveOutcomeStatus(status?: string) {
  return status ? ACTIVE_OUTCOME_STATUSES.has(status) : false;
}

function resolveLatestRunId(runs: Array<{ createdAt: string; id: string }>) {
  return [...runs]
    .sort((left, right) => {
      const createdDelta = left.createdAt.localeCompare(right.createdAt);

      if (createdDelta !== 0) {
        return createdDelta;
      }

      return left.id.localeCompare(right.id);
    })
    .at(-1)?.id ?? null;
}

export default async function OutcomeDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    runId?: string | string[];
    bootstrap?: string | string[];
    conflict?: string | string[];
  }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const runIdParam = resolvedSearchParams.runId;
  const bootstrapParam = resolvedSearchParams.bootstrap;
  const conflictParam = resolvedSearchParams.conflict;
  const selectedRunId =
    typeof runIdParam === "string" ? runIdParam : runIdParam?.[0];
  const bootstrapState =
    typeof bootstrapParam === "string" ? bootstrapParam : bootstrapParam?.[0] ?? null;
  const conflictState =
    typeof conflictParam === "string" ? conflictParam : conflictParam?.[0] ?? null;
  const threadSnapshot = await getOutcomeThreadSnapshot(id);

  if (!threadSnapshot) {
    notFound();
  }

  const outcome = threadSnapshot.outcome;
  const outcomes = await listOutcomes(outcome.workspaceId);
  const latestRunId = resolveLatestRunId(threadSnapshot.runs);
  const latestRun =
    (latestRunId
      ? threadSnapshot.runs.find((run) => run.id === latestRunId)
      : null) ?? null;
  const latestPlan =
    (latestRun
      ? threadSnapshot.plans.find((plan) => plan.id === latestRun.planId)
      : threadSnapshot.plans.at(-1) ?? null) ?? null;
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

    try {
      const response = await continueOutcome(id, {
        content
      });

      if (response.run?.id) {
        redirect(`/outcomes/${id}?runId=${response.run.id}`);
        return;
      }

      revalidatePath(`/outcomes/${id}`);
    } catch (error) {
      if (error instanceof OutcomeContinueConflictError) {
        const targetPath = selectedRunId
          ? `/outcomes/${id}?runId=${selectedRunId}&conflict=active-run`
          : `/outcomes/${id}?conflict=active-run`;
        redirect(targetPath);
        return;
      }

      throw error;
    }
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
            {latestRun ? (
              <span className="rounded-full border border-panel-line/70 bg-surface-elevated/70 px-3 py-1 text-[11px] font-semibold text-muted">
                {latestRun.steps.length} {latestRun.steps.length === 1 ? "step" : "steps"}
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

            {conflictState === "active-run" ? (
              <p className="rounded-xl border border-amber-300/40 bg-amber-50/40 px-4 py-3 text-sm text-amber-800">
                Mycelium is still working on the current run. Wait for it to
                finish before sending a follow-up.
              </p>
            ) : null}

            <OutcomeConversation
              outcomeId={outcome.id}
              outcomePrompt={outcome.prompt}
              outcomeSource={outcome.source}
              initialPlan={latestPlan}
              initialRun={latestRun}
              initialThread={{
                isHydrated: true,
                plans: threadSnapshot.plans,
                runs: threadSnapshot.runs
              }}
              initialArtifacts={threadSnapshot.artifacts}
              initialLogs={threadSnapshot.logs}
              initialAssistantMessages={threadSnapshot.assistantMessages}
              initialMessages={threadSnapshot.messages}
              initialPendingApprovals={threadSnapshot.pendingApprovals}
            />
          </div>
        </div>

        {/* ── Sticky follow-up input with gradient fade ───────────── */}
        <FollowUpInput
          action={appendMessageAction}
          hasConversation={
            threadSnapshot.messages.length > 0 ||
            threadSnapshot.assistantMessages.length > 0 ||
            threadSnapshot.runs.length > 0 ||
            threadSnapshot.artifacts.length > 0
          }
          disabled={isActiveOutcomeStatus(outcome.status)}
        />
      </section>
    </main>
  );
}
