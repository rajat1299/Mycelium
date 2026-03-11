"use client";

import { startTransition, useEffect, useState } from "react";
import type { Outcome } from "@computer-oss/protocol";
import { subscribeToOutcomeEvents } from "../../lib/events";
import type { ActivityEntry } from "../../lib/types";

type OutcomeActivityProps = {
  outcome: Outcome;
};

function initialEntry(outcome: Outcome): ActivityEntry {
  return {
    id: `${outcome.id}:initial`,
    title: "Outcome created",
    body: `Current status: ${outcome.status}`,
    timestamp: outcome.updatedAt
  };
}

export function OutcomeActivity({ outcome }: OutcomeActivityProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([initialEntry(outcome)]);

  useEffect(() => {
    setEntries([initialEntry(outcome)]);

    return subscribeToOutcomeEvents(outcome.id, (event) => {
      startTransition(() => {
        setEntries((current) => {
          const nextEntry =
            event.type === "outcome.updated"
              ? {
                  id: `${event.outcomeId}:${event.type}:${event.data.updatedAt}`,
                  title: "Outcome updated",
                  body: `Status is now ${event.data.status}`,
                  timestamp: event.data.updatedAt
                }
              : {
                  id: event.data.id,
                  title: `${event.data.role} message`,
                  body: event.data.content,
                  timestamp: event.data.createdAt
                };

          return [nextEntry, ...current].slice(0, 12);
        });
      });
    });
  }, [outcome]);

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
          Live activity
        </p>
        <h2 className="font-serif text-3xl tracking-tight text-ink">
          Event stream
        </h2>
        <p className="text-sm leading-6 text-muted">
          This panel subscribes to the outcome SSE stream and shows the newest events
          first.
        </p>
      </div>

      <ul className="mt-6 space-y-3">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-[1.5rem] border border-panel-line bg-white/75 px-4 py-4"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-ink">{entry.title}</p>
              <p className="text-xs text-muted">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{entry.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
