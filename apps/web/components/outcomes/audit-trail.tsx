"use client";

import type { AuditEvent } from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type AuditTrailProps = {
  selectedRunId: string | null;
  events: AuditEvent[];
};

function sortEvents(events: AuditEvent[]) {
  return [...events].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function AuditTrail({ selectedRunId, events }: AuditTrailProps) {
  const orderedEvents = sortEvents(events);

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Audit
          </p>
          <h2 className="font-serif text-3xl tracking-tight text-ink">Operator trail</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted [text-wrap:pretty]">
            Lifecycle, checkpoint, approval, and resume transitions stay in one
            stable sequence so interruption history is readable after the fact.
          </p>
        </div>
        <Badge variant={orderedEvents.length > 0 ? "sky" : "slate"}>
          {orderedEvents.length} event{orderedEvents.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {!selectedRunId ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-white/55 px-5 py-8 text-sm leading-6 text-muted">
          Select a run to inspect the durable audit history.
        </div>
      ) : orderedEvents.length === 0 ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-white/55 px-5 py-8 text-sm leading-6 text-muted">
          Audit history will appear here as the control plane persists lifecycle and
          checkpoint events for the selected run.
        </div>
      ) : (
        <ol className="mt-6 space-y-3">
          {orderedEvents.map((event) => (
            <li
              key={event.id}
              className="rounded-[1.5rem] border border-panel-line bg-white/78 px-5 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="slate" size="sm">
                      #{event.sequence}
                    </Badge>
                    <Badge size="sm">{event.category}</Badge>
                    <Badge variant="sky" size="sm">
                      {event.actorType}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-ink">{event.summary}</p>
                  <p className="font-mono text-[11px] text-muted">
                    {event.eventType}
                    {event.checkpointId ? ` · ${event.checkpointId}` : ""}
                    {event.stepId ? ` · ${event.stepId}` : ""}
                  </p>
                </div>
                <p className="text-xs tabular-nums text-muted">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
