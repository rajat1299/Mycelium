"use client";

import type {
  RemoteStepLifecycleEventData,
  RemoteWorker,
  RunDetail
} from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type RemoteWorkerPanelProps = {
  run: RunDetail | null;
  workers: RemoteWorker[];
  remoteStepStates: Record<string, RemoteStepLifecycleEventData>;
  statusMessage: {
    tone: "default" | "error";
    text: string;
  } | null;
};

function availabilityVariant(availability: RemoteWorker["availability"]) {
  switch (availability) {
    case "available":
      return "emerald";
    case "busy":
      return "sky";
    case "draining":
      return "amber";
    default:
      return "slate";
  }
}

function healthVariant(status: RemoteWorker["health"]["status"]) {
  switch (status) {
    case "healthy":
      return "emerald";
    case "degraded":
      return "amber";
    default:
      return "slate";
  }
}

function remoteStatusVariant(status: RemoteStepLifecycleEventData["status"]) {
  switch (status) {
    case "completed":
      return "emerald";
    case "failed":
    case "cancelled":
    case "interrupted":
      return "amber";
    default:
      return "sky";
  }
}

export function RemoteWorkerPanel({
  run,
  workers,
  remoteStepStates,
  statusMessage
}: RemoteWorkerPanelProps) {
  const remoteSteps =
    run?.steps.filter((step) => step.executionTarget === "remote_worker") ?? [];
  const assignedWorkers = remoteSteps.reduce<
    Array<{
      workerId: string;
      workerSessionId: string;
      worker: RemoteWorker | null;
    }>
  >((current, step) => {
    if (!step.remoteWorkerId || !step.remoteWorkerSessionId) {
      return current;
    }

    if (
      current.some(
        (assignment) =>
          assignment.workerId === step.remoteWorkerId &&
          assignment.workerSessionId === step.remoteWorkerSessionId
      )
    ) {
      return current;
    }

    return [
      ...current,
      {
        workerId: step.remoteWorkerId,
        workerSessionId: step.remoteWorkerSessionId,
        worker:
          workers.find(
            (worker) =>
              worker.id === step.remoteWorkerId &&
              worker.sessionId === step.remoteWorkerSessionId
          ) ?? null
      }
    ];
  }, []);

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Remote execution
          </p>
          <h2 className="font-serif text-xl tracking-tight text-ink">
            Worker visibility
          </h2>
          <p className="text-sm leading-6 text-muted">
            Worker assignment, daemon health, and interruption recovery stay visible
            on the selected run.
          </p>
        </div>
        {run ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="slate">{assignedWorkers.length} workers</Badge>
            <Badge variant={run.status === "interrupted" ? "amber" : "slate"}>
              {run.status}
            </Badge>
          </div>
        ) : null}
      </div>

      {!run ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-shell px-5 py-8 text-sm leading-6 text-muted">
          Start a run to inspect its remote worker assignment and live worker state.
        </div>
      ) : remoteSteps.length === 0 ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-shell px-5 py-8 text-sm leading-6 text-muted">
          The selected run is currently executing without a remote worker assignment.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {statusMessage ? (
            <div
              className={[
                "rounded-[1.5rem] border px-4 py-4 text-sm leading-6",
                statusMessage.tone === "error"
                  ? "border-amber-200/80 bg-amber-50/90 text-amber-950"
                  : "border-sky-200/80 bg-sky-50/90 text-sky-950"
              ].join(" ")}
            >
              {statusMessage.text}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {assignedWorkers.map((assignment) => (
              <article
                key={`${assignment.workerId}:${assignment.workerSessionId}`}
                className="rounded-[1.6rem] border border-panel-line bg-surface-elevated px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-ink">
                      {assignment.worker?.label ?? assignment.workerId}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">
                      {assignment.workerId}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={
                        assignment.worker
                          ? availabilityVariant(assignment.worker.availability)
                          : "slate"
                      }
                      size="sm"
                    >
                      {assignment.worker?.availability ?? "unknown"}
                    </Badge>
                    <Badge
                      variant={
                        assignment.worker
                          ? healthVariant(assignment.worker.health.status)
                          : "slate"
                      }
                      size="sm"
                    >
                      {assignment.worker?.health.status ?? "unknown"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm leading-6 text-muted">
                  <p>Session {assignment.workerSessionId}</p>
                  <p>Daemon {assignment.worker?.daemonVersion ?? "unavailable"}</p>
                  <p>
                    Last heartbeat{" "}
                    {new Date(
                      assignment.worker?.health.lastHeartbeatAt ?? run.updatedAt
                    ).toLocaleTimeString()}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="space-y-3">
            {remoteSteps.map((step) => {
              const remoteState = remoteStepStates[step.id] ?? null;

              return (
                <div
                  key={step.id}
                  className="rounded-[1.6rem] border border-panel-line bg-surface-elevated px-5 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-ink">{step.title}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted">
                        {step.remoteWorkerId ?? "remote worker"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="slate" size="sm">
                        {step.executionTarget}
                      </Badge>
                      <Badge
                        variant={remoteState ? remoteStatusVariant(remoteState.status) : "slate"}
                        size="sm"
                      >
                        {remoteState?.status ?? step.status}
                      </Badge>
                    </div>
                  </div>
                  {remoteState?.message ? (
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {remoteState.message}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
