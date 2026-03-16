"use client";

import { startTransition, useEffect, useState } from "react";
import type { Outcome, OutcomeStreamEvent } from "@computer-oss/protocol";
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
    timestamp: outcome.updatedAt,
    tone: "default"
  };
}

function createEntryFromEvent(event: OutcomeStreamEvent): ActivityEntry {
  switch (event.type) {
    case "outcome.updated":
      return {
        id: `${event.outcomeId}:${event.type}:${event.data.updatedAt}`,
        title: "Outcome updated",
        body: `Status is now ${event.data.status}`,
        timestamp: event.data.updatedAt,
        tone: "default"
      };
    case "message.created":
      return {
        id: event.data.id,
        title: `${event.data.role} message`,
        body: event.data.content,
        timestamp: event.data.createdAt,
        tone: "accent"
      };
    case "plan.created":
      return {
        id: `${event.data.id}:created`,
        title: "Draft plan created",
        body: `${event.data.nodes.length} nodes across ${event.data.edges.length} dependencies are now visible to the operator console.`,
        timestamp: event.data.updatedAt,
        tone: "accent"
      };
    case "run.created":
      return {
        id: `${event.data.id}:created`,
        title: "Run queued",
        body: `Run ${event.data.id} was created from ${event.data.planId}.`,
        timestamp: event.data.createdAt,
        tone: "warning"
      };
    case "run.updated":
      return {
        id: `${event.data.id}:${event.data.updatedAt}`,
        title: `Run ${event.data.status}`,
        body: `Run ${event.data.id} is now ${event.data.status}.`,
        timestamp: event.data.updatedAt,
        tone:
          event.data.status === "completed"
            ? "success"
            : event.data.status === "failed"
              ? "warning"
              : "default"
      };
    case "run.log":
      return {
        id: `${event.data.runId}:log:${event.data.createdAt}:${event.data.message}`,
        title: event.data.stepTitle ? `${event.data.stepTitle} log` : "Run log",
        body: event.data.message,
        timestamp: event.data.createdAt,
        tone: event.data.level === "error" ? "warning" : "default"
      };
    case "artifact.created":
      return {
        id: `${event.data.id}:created`,
        title: "Artifact created",
        body: `${event.data.relativePath} was persisted for the run.`,
        timestamp: event.data.createdAt,
        tone: "success"
      };
    case "checkpoint.created":
      return {
        id: `${event.data.id}:created`,
        title: "Checkpoint created",
        body: `Checkpoint ${event.data.kind} (#${event.data.sequence}) was persisted for the run.`,
        timestamp: event.data.createdAt,
        tone: "accent"
      };
    case "run.step.updated":
      return {
        id: `${event.data.id}:${event.data.updatedAt}`,
        title: `Step ${event.data.status}`,
        body: `${event.data.title} is now ${event.data.status}.`,
        timestamp: event.data.updatedAt,
        tone:
          event.data.status === "ready" || event.data.status === "completed"
            ? "success"
            : "warning"
      };
    case "approval.requested":
      return {
        id: `${event.data.id}:requested:${event.data.requestedAt}`,
        title: "Approval requested",
        body: `${event.data.title} is waiting for operator review.${event.data.instruction ? ` ${event.data.instruction}` : ""}`,
        timestamp: event.data.requestedAt,
        tone: "warning"
      };
    case "approval.resolved": {
      const resolutionTitle =
        event.data.resolution === "approved"
          ? "Approval approved"
          : event.data.resolution === "rejected"
            ? "Approval rejected"
            : "Approval cancelled";

        return {
          id: `${event.data.id}:resolved:${event.data.resolvedAt ?? event.data.requestedAt}`,
          title: resolutionTitle,
          body: `${event.data.title} ${event.data.resolution}.${event.data.resolutionNote ? ` ${event.data.resolutionNote}` : ""}`,
          timestamp: event.data.resolvedAt ?? event.data.requestedAt,
        tone:
          event.data.resolution === "approved"
            ? "success"
            : "warning"
        };
      }
    case "worker.connected":
      return {
        id: `${event.data.id}:connected:${event.data.updatedAt}`,
        title: "Worker connected",
        body: `${event.data.label} is now ${event.data.availability}.`,
        timestamp: event.data.updatedAt,
        tone: "success"
      };
    case "worker.disconnected":
      return {
        id: `${event.data.id}:disconnected:${event.data.updatedAt}`,
        title: "Worker disconnected",
        body: `${event.data.label} went offline.`,
        timestamp: event.data.updatedAt,
        tone: "warning"
      };
    case "remote.step.updated":
      return {
        id: `${event.data.stepId}:${event.data.status}:${event.data.occurredAt}`,
        title: `Remote step ${event.data.status}`,
        body: `Step ${event.data.stepId} is ${event.data.status} on worker ${event.data.assignment.workerId}.${event.data.message ? ` ${event.data.message}` : ""}`,
        timestamp: event.data.occurredAt,
        tone:
          event.data.status === "completed"
            ? "success"
            : event.data.status === "failed" || event.data.status === "interrupted"
              ? "warning"
              : "accent"
      };
    case "run.interrupted":
      return {
        id: `${event.data.run.id}:interrupted:${event.data.run.updatedAt}`,
        title: "Run interrupted",
        body: `Run ${event.data.run.id} interrupted from checkpoint ${event.data.interruptedFromCheckpointId}.`,
        timestamp: event.data.run.updatedAt,
        tone: "warning"
      };
    case "run.resumed":
      return {
        id: `${event.data.run.id}:resumed:${event.data.run.updatedAt}`,
        title: "Run resumed",
        body: `Run ${event.data.run.id} resumed from checkpoint ${event.data.resumedFromCheckpointId}.`,
        timestamp: event.data.run.updatedAt,
        tone: "success"
      };
  }

  const exhaustive: never = event;
  throw new Error(`Unhandled outcome activity event: ${exhaustive}`);
}

export function OutcomeActivity({ outcome }: OutcomeActivityProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([initialEntry(outcome)]);

  useEffect(() => {
    setEntries([initialEntry(outcome)]);

    return subscribeToOutcomeEvents(outcome.id, (event) => {
      startTransition(() => {
        setEntries((current) => {
          const nextEntry = createEntryFromEvent(event);

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
            className={[
              "rounded-[1.5rem] border px-4 py-4",
              entry.tone === "accent"
                ? "border-accent/20 bg-accent-soft/70"
                : entry.tone === "success"
                  ? "border-emerald-200/80 bg-emerald-50/90"
                  : entry.tone === "warning"
                    ? "border-amber-200/80 bg-amber-50/90"
                    : "border-panel-line bg-white/75"
            ].join(" ")}
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
