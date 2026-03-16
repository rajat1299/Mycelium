"use client";

import type { CheckpointSummary } from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type CheckpointTimelineProps = {
  selectedRunId: string | null;
  checkpoints: CheckpointSummary[];
  selectedCheckpointId: string | null;
  onSelectCheckpoint: (checkpointId: string) => void;
};

function sortCheckpoints(checkpoints: CheckpointSummary[]) {
  return [...checkpoints].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return right.sequence - left.sequence;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function CheckpointTimeline({
  selectedRunId,
  checkpoints,
  selectedCheckpointId,
  onSelectCheckpoint
}: CheckpointTimelineProps) {
  const orderedCheckpoints = sortCheckpoints(checkpoints);

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Checkpoints
          </p>
          <h2 className="font-serif text-3xl tracking-tight text-ink">
            Replay anchors
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted [text-wrap:pretty]">
            Durable snapshots mark safe execution boundaries and make interruption or
            resume state inspectable without replaying the whole run in your head.
          </p>
        </div>
        <Badge variant={orderedCheckpoints.length > 0 ? "sky" : "slate"}>
          {orderedCheckpoints.length} checkpoint
          {orderedCheckpoints.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {!selectedRunId ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-white/55 px-5 py-8 text-sm leading-6 text-muted">
          Select a run to inspect durable checkpoints and replay anchors.
        </div>
      ) : orderedCheckpoints.length === 0 ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-white/55 px-5 py-8 text-sm leading-6 text-muted">
          No checkpoints have been persisted for this run yet.
        </div>
      ) : (
        <ol className="mt-6 space-y-3">
          {orderedCheckpoints.map((checkpoint, index) => {
            const selected = checkpoint.id === selectedCheckpointId;

            return (
              <li key={checkpoint.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectCheckpoint(checkpoint.id)}
                  className={[
                    "group flex w-full items-start justify-between gap-4 rounded-[1.55rem] border px-5 py-4 text-left transition",
                    selected
                      ? "border-accent/35 bg-[linear-gradient(135deg,rgba(13,139,123,0.08),rgba(15,111,120,0.04))] shadow-[0_18px_40px_rgba(13,139,123,0.12)]"
                      : "border-panel-line bg-white/78 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(39,27,13,0.08)]"
                  ].join(" ")}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">Checkpoint #{checkpoint.sequence}</p>
                      <Badge size="sm" variant={checkpoint.resumable ? "emerald" : "amber"}>
                        {checkpoint.resumable ? "resumable" : "terminal"}
                      </Badge>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">
                      {checkpoint.kind.replaceAll("_", " ")}
                    </p>
                    <p className="text-sm leading-6 text-muted">
                      {checkpoint.stepId ? `step ${checkpoint.stepId}` : "run-level boundary"}{" "}
                      captured {new Date(checkpoint.createdAt).toLocaleString()}.
                    </p>
                  </div>
                  <div className="flex min-w-fit flex-col items-end gap-2">
                    <Badge variant="slate" size="sm">
                      {checkpoint.byteSize} B
                    </Badge>
                    <p className="font-mono text-[11px] text-muted">
                      {index === 0 ? "latest" : `#${checkpoint.sequence}`}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
