import Link from "next/link";
import { notFound } from "next/navigation";
import { OutcomeActivity } from "../../../components/outcomes/outcome-activity";
import { getOutcome } from "../../../lib/api";

export const dynamic = "force-dynamic";

export default async function OutcomeDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const outcome = await getOutcome(id);

  if (!outcome) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
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

      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-3xl border border-panel-line bg-panel p-6 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Current brief
          </p>
          <p className="mt-4 text-base leading-7 text-ink">{outcome.prompt}</p>
        </article>
        <OutcomeActivity outcome={outcome} />
      </section>
    </main>
  );
}
