"use client";

import type { RunLogData } from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type RunLogPanelProps = {
  selectedRunId: string | null;
  logs: RunLogData[];
};

function sortLogs(logs: RunLogData[]) {
  return [...logs].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function logKey(log: RunLogData) {
  return [
    log.runId,
    log.stepId ?? "run",
    log.createdAt,
    log.level,
    log.message
  ].join(":");
}

function levelVariant(level: RunLogData["level"]) {
  return level === "error" ? "amber" : "sky";
}

export function RunLogPanel({
  selectedRunId,
  logs
}: RunLogPanelProps) {
  const orderedLogs = sortLogs(logs);

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Run logs
          </p>
          <h2 className="font-serif text-3xl tracking-tight text-ink">
            Operator log stream
          </h2>
          <p className="text-sm leading-6 text-muted">
            Streaming step output is pinned to the currently selected run.
          </p>
        </div>
        <Badge variant={orderedLogs.length > 0 ? "sky" : "slate"}>
          {orderedLogs.length} entr{orderedLogs.length === 1 ? "y" : "ies"}
        </Badge>
      </div>

      {!selectedRunId || orderedLogs.length === 0 ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-white/55 px-5 py-8 text-sm leading-6 text-muted">
          Live step and run logs will appear here.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orderedLogs.map((log) => (
            <li
              key={logKey(log)}
              className="rounded-[1.5rem] border border-panel-line bg-white/78 px-5 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ink">
                    {log.stepTitle ?? "Run event"}
                  </p>
                  <p className="text-sm leading-6 text-muted">{log.message}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={levelVariant(log.level)} size="sm">
                    {log.level}
                  </Badge>
                  <p className="text-xs text-muted">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
