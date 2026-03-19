"use client";

import type { CheckpointDetail, RunDetail } from "@computer-oss/protocol";
import { RichButton } from "../ui/rich-button";
import { Badge } from "../ui/badge";

type CheckpointDetailCardProps = {
  run: RunDetail | null;
  checkpoint: CheckpointDetail | null;
  onResume: (checkpointId: string) => void;
  isResuming: boolean;
  statusMessage?: {
    tone: "default" | "error";
    text: string;
  } | null;
};

function formatCheckpointKind(kind: string) {
  return kind.replaceAll("_", " ");
}

export function CheckpointDetailCard({
  run,
  checkpoint,
  onResume,
  isResuming,
  statusMessage = null
}: CheckpointDetailCardProps) {
  if (!run) {
    return (
      <section className="rounded-[2rem] border border-dashed border-panel-line bg-shell p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
          Checkpoint detail
        </p>
        <h2 className="mt-2 font-serif text-xl tracking-tight text-ink">
          No selected run
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Start or select a run to inspect a checkpoint payload, replay state, and the
          resumable boundary.
        </p>
      </section>
    );
  }

  if (!checkpoint) {
    return (
      <section className="rounded-[2rem] border border-dashed border-panel-line bg-shell p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
          Checkpoint detail
        </p>
        <h2 className="mt-2 font-serif text-xl tracking-tight text-ink">
          Select a checkpoint
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Pick a persisted checkpoint to inspect its payload, ready-step frontier, and
          workspace snapshot.
        </p>
      </section>
    );
  }

  const canResume =
    run.status === "interrupted" && run.resumable === true && checkpoint.resumable;

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Checkpoint detail
          </p>
          <h2 className="font-serif text-xl tracking-tight text-ink">
            Checkpoint #{checkpoint.sequence}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted [text-wrap:pretty]">
            {formatCheckpointKind(checkpoint.kind)} captured{" "}
            {new Date(checkpoint.createdAt).toLocaleString()} with checksum{" "}
            <span className="font-mono text-[12px]">{checkpoint.checksum.slice(0, 12)}</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={checkpoint.resumable ? "emerald" : "amber"}>
            {checkpoint.resumable ? "resumable" : "not resumable"}
          </Badge>
          <Badge variant="slate">{checkpoint.byteSize} B</Badge>
          {checkpoint.stepId ? (
            <Badge variant="sky">step {checkpoint.stepId}</Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-[1.6rem] bg-surface-elevated p-5 shadow-[inset_0_1px_0_var(--panel-line)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Run snapshot
              </p>
              <Badge variant="slate" size="sm">
                latest audit sequence {checkpoint.payload.latestAuditSequence}
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge size="sm">{checkpoint.payload.run.status}</Badge>
              <Badge variant="slate" size="sm">
                {checkpoint.payload.artifactIds.length} artifact
                {checkpoint.payload.artifactIds.length === 1 ? "" : "s"}
              </Badge>
              <Badge variant="sky" size="sm">
                {checkpoint.payload.readyStepIds.length} ready
              </Badge>
              <Badge variant="amber" size="sm">
                {checkpoint.payload.blockedStepIds.length} blocked
              </Badge>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
              <li>
                <span className="font-semibold text-ink">input</span>:{" "}
                <span className="font-mono text-[12px]">
                  {checkpoint.payload.workspacePaths.inputDir}
                </span>
              </li>
              <li>
                <span className="font-semibold text-ink">logs</span>:{" "}
                <span className="font-mono text-[12px]">
                  {checkpoint.payload.workspacePaths.logsDir}
                </span>
              </li>
              <li>
                <span className="font-semibold text-ink">artifacts</span>:{" "}
                <span className="font-mono text-[12px]">
                  {checkpoint.payload.workspacePaths.artifactsDir}
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-[1.6rem] bg-surface-elevated p-5 shadow-[inset_0_1px_0_var(--panel-line)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Step frontier
              </p>
              <Badge variant="slate" size="sm">
                {checkpoint.payload.steps.length} steps
              </Badge>
            </div>
            <ul className="mt-4 space-y-3">
              {checkpoint.payload.steps.map((step) => (
                <li
                  key={step.stepId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-panel-line bg-surface-elevated px-4 py-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-ink">{step.title}</p>
                    <p className="font-mono text-[11px] text-muted">{step.stepId}</p>
                  </div>
                  <Badge
                    size="sm"
                    variant={
                      step.status === "completed"
                        ? "emerald"
                        : step.status === "ready"
                          ? "sky"
                          : "amber"
                    }
                  >
                    {step.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.6rem] bg-[linear-gradient(180deg,rgba(242,223,191,0.38),rgba(255,255,255,0.72))] p-5 shadow-[0_20px_44px_rgba(78,56,19,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Resume boundary
            </p>
            <p className="mt-3 text-sm leading-6 text-ink">
              {canResume
                ? "This checkpoint can restart the interrupted run without rerunning already completed work."
                : "Resume is only available when the selected run is interrupted and this checkpoint is marked resumable."}
            </p>
            {canResume ? (
              <div className="mt-5 max-w-xs">
                <RichButton
                  type="button"
                  color="accent"
                  onClick={() => onResume(checkpoint.id)}
                  disabled={isResuming}
                  aria-label="Resume from checkpoint"
                >
                  {isResuming ? "Resuming run" : "Resume from checkpoint"}
                </RichButton>
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.6rem] bg-surface-elevated p-5 shadow-[inset_0_1px_0_var(--panel-line)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Artifact ids
              </p>
              <Badge variant="slate" size="sm">
                {checkpoint.payload.artifactIds.length}
              </Badge>
            </div>
            {checkpoint.payload.artifactIds.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-muted">
                No persisted artifacts were attached to this checkpoint payload.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {checkpoint.payload.artifactIds.map((artifactId) => (
                  <li
                    key={artifactId}
                    className="rounded-[1.1rem] border border-panel-line bg-surface-elevated px-3 py-2 font-mono text-[12px] text-muted"
                  >
                    {artifactId}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {statusMessage ? (
        <p
          className={[
            "mt-4 text-sm leading-6",
            statusMessage.tone === "error" ? "text-amber-900" : "text-muted"
          ].join(" ")}
        >
          {statusMessage.text}
        </p>
      ) : null}
    </section>
  );
}
