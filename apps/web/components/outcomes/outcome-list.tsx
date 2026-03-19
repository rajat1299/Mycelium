import Link from "next/link";
import type { OutcomeListItem } from "../../lib/types";

type OutcomeListProps = {
  outcomes: OutcomeListItem[];
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function OutcomeList({ outcomes }: OutcomeListProps) {
  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Active outcomes
          </p>
          <h2 className="mt-2 font-serif text-xl tracking-tight text-ink">
            Running queue
          </h2>
        </div>
        <div className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {outcomes.length} total
        </div>
      </div>

      {outcomes.length === 0 ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-panel-line bg-shell p-6 text-sm leading-6 text-muted">
          No outcomes yet. Create one from the panel on the left to start the first
          run.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {outcomes.map((outcome) => (
            <li key={outcome.id}>
              <Link
                href={`/outcomes/${outcome.id}`}
                className="flex items-start justify-between gap-4 rounded-[1.5rem] border border-panel-line bg-surface-elevated px-4 py-4 transition hover:border-accent hover:bg-panel"
              >
                <div className="space-y-2">
                  <p className="text-sm font-medium leading-6 text-ink">
                    {outcome.prompt}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    {outcome.status}
                  </p>
                </div>
                <p className="whitespace-nowrap text-xs text-muted">
                  {formatTimestamp(outcome.updatedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
