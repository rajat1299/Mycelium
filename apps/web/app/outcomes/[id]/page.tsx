import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OutcomeActivity } from "../../../components/outcomes/outcome-activity";
import { PlanActions } from "../../../components/outcomes/plan-actions";
import { PlanGraph } from "../../../components/outcomes/plan-graph";
import { RunTimeline } from "../../../components/outcomes/run-timeline";
import {
  createPlan,
  createRun,
  getLatestRun,
  getOutcome,
  getPlan,
  getRun
} from "../../../lib/api";

export const dynamic = "force-dynamic";

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
    selectedRunId ? getRun(selectedRunId) : getLatestRun(id)
  ]);

  if (!outcome) {
    notFound();
  }

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
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Outcome
          </p>
          <h1 className="max-w-3xl font-serif text-4xl tracking-tight text-ink">
            {outcome.prompt}
          </h1>
          <div className="flex flex-wrap gap-3 text-sm text-muted">
            <span>Status: {outcome.status}</span>
            <span>Source: {outcome.source}</span>
            <span>Updated: {new Date(outcome.updatedAt).toLocaleString()}</span>
          </div>
        </div>
        <Link
          href="/"
          className="rounded-full border border-panel-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent hover:text-accent"
        >
          Back to outcomes
        </Link>
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
          <RunTimeline
            outcomeId={outcome.id}
            initialRun={run}
            selectedRunId={selectedRunId ?? run?.id ?? null}
          />
          <OutcomeActivity outcome={outcome} />
        </div>
      </section>
    </main>
  );
}
