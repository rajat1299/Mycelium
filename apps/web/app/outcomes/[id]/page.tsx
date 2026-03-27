import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { OutcomeThreadPageShell } from "../../../components/outcomes/outcome-thread-page-shell";
import { TasksPane } from "../../../components/outcomes/tasks-pane";
import {
  continueOutcome,
  getOutcomeThreadSnapshot,
  listOutcomes,
  OutcomeContinueConflictError,
} from "../../../lib/api";
import { deriveOutcomeTitle } from "../../../lib/outcome-title";

export const dynamic = "force-dynamic";

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
  const initialSubmissionId = `submit_${randomUUID()}`;
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
    const submissionId =
      String(formData.get("submissionId") ?? "").trim() || `submit_${randomUUID()}`;

    if (!content) {
      return;
    }

    try {
      const response = await continueOutcome(id, {
        content,
        submissionId
      });

      if (response.run?.id) {
        redirect(`/outcomes/${id}?runId=${response.run.id}`);
        return;
      }

      revalidatePath(`/outcomes/${id}`);
    } catch (error) {
      if (error instanceof OutcomeContinueConflictError) {
        const conflictReason =
          error.reason === "replay-content" ? "replay-content" : "active-run";
        const targetPath = selectedRunId
          ? `/outcomes/${id}?runId=${selectedRunId}&conflict=${conflictReason}`
          : `/outcomes/${id}?conflict=${conflictReason}`;
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
        <OutcomeThreadPageShell
          outcome={outcome}
          outcomeTitle={outcomeTitle}
          initialSubmissionId={initialSubmissionId}
          bootstrapState={bootstrapState}
          conflictState={conflictState}
          appendMessageAction={appendMessageAction}
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
          initialPresentationHints={threadSnapshot.presentationHints}
          outcomePrompt={outcome.prompt}
          outcomeSource={outcome.source}
        />
      </section>
    </main>
  );
}
