"use client";

import Link from "next/link";
import type { Outcome } from "@computer-oss/protocol";
import { deriveOutcomeTitle } from "../../lib/outcome-title";
import { cn } from "../ui/cn";

type TasksPaneProps = {
  outcomes: Outcome[];
  selectedOutcomeId: string | null;
};

function formatStatus(status: Outcome["status"]) {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "blocked_on_approval":
      return "Waiting for review";
    case "completed":
      return "Complete";
    case "failed":
      return "Failed";
    case "scheduled":
      return "Scheduled";
    case "planning":
      return "Planning";
    default:
      return "Draft";
  }
}

function statusTone(status: Outcome["status"]) {
  switch (status) {
    case "running":
      return "text-accent";
    case "completed":
      return "text-emerald-700 dark:text-emerald-300";
    case "failed":
      return "text-amber-700 dark:text-amber-300";
    default:
      return "text-muted";
  }
}

export function TasksPane({ outcomes, selectedOutcomeId }: TasksPaneProps) {
  return (
    <aside className="hidden w-[360px] shrink-0 flex-col border-r border-panel-line bg-sidebar-bg/45 lg:flex">
      <div className="border-b border-panel-line px-6 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[1.05rem] font-semibold tracking-tight text-ink">
            Tasks
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Conversation layout"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-panel-line bg-panel text-muted transition-colors hover:text-ink"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Task filters"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-panel-line bg-panel text-muted transition-colors hover:text-ink"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
            </button>
          </div>
        </div>

        <Link
          href="/"
          className="mt-5 flex h-14 items-center rounded-[1.35rem] border border-panel-line bg-panel px-5 text-base text-muted transition-colors hover:text-ink"
        >
          Start a task
        </Link>
      </div>

      <div className="grid grid-cols-[132px_minmax(0,1fr)] border-b border-panel-line px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
        <span>Status</span>
        <span>Task</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {outcomes.length === 0 ? (
          <div className="px-6 py-8 text-sm leading-6 text-muted">
            No tasks yet. Start from the home screen to create one.
          </div>
        ) : (
          <ul className="divide-y divide-panel-line">
            {outcomes.map((outcome) => {
              const active = outcome.id === selectedOutcomeId;

              return (
                <li key={outcome.id}>
                  <Link
                    href={`/outcomes/${outcome.id}`}
                    className={cn(
                      "grid grid-cols-[132px_minmax(0,1fr)] gap-4 px-6 py-4 transition-colors",
                      active
                        ? "bg-sidebar-active"
                        : "hover:bg-sidebar-hover"
                    )}
                  >
                    <div
                      className={cn(
                        "truncate text-sm font-medium",
                        statusTone(outcome.status)
                      )}
                    >
                      {formatStatus(outcome.status)}
                    </div>
                    <div className="min-w-0 text-sm font-medium text-ink">
                      <p className="truncate">{deriveOutcomeTitle(outcome.prompt)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
