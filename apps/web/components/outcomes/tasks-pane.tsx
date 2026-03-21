"use client";

import Link from "next/link";
import type { Outcome } from "@computer-oss/protocol";
import { deriveOutcomeTitle } from "../../lib/outcome-title";
import { cn } from "../ui/cn";

type TasksPaneProps = {
  outcomes: Outcome[];
  selectedOutcomeId: string | null;
};

function statusDotColor(status: Outcome["status"]) {
  switch (status) {
    case "running":
    case "planning":
      return "bg-accent";
    case "completed":
      return "bg-emerald-500";
    case "failed":
      return "bg-amber-500";
    case "blocked_on_approval":
      return "bg-amber-400";
    default:
      return "bg-muted/40";
  }
}

export function TasksPane({ outcomes, selectedOutcomeId }: TasksPaneProps) {
  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-panel-line bg-sidebar-bg/45 lg:flex">
      <div className="flex items-center justify-between border-b border-panel-line px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight text-ink">
          Tasks
        </h2>
        <Link
          href="/"
          className="flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-hover"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {outcomes.length === 0 ? (
          <div className="px-5 py-6 text-[13px] leading-6 text-muted">
            No tasks yet.
          </div>
        ) : (
          <ul>
            {outcomes.map((outcome) => {
              const active = outcome.id === selectedOutcomeId;

              return (
                <li key={outcome.id}>
                  <Link
                    href={`/outcomes/${outcome.id}`}
                    className={cn(
                      "flex items-center gap-3 px-5 py-2.5 transition-colors",
                      active
                        ? "bg-sidebar-active"
                        : "hover:bg-sidebar-hover"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        statusDotColor(outcome.status)
                      )}
                    />
                    <span className="min-w-0 truncate text-[13px] font-medium text-ink">
                      {deriveOutcomeTitle(outcome.prompt)}
                    </span>
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
