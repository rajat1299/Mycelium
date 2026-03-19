"use client";

import type { Artifact } from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type ArtifactListProps = {
  selectedRunId: string | null;
  artifacts: Artifact[];
};

function sortArtifacts(artifacts: Artifact[]) {
  return [...artifacts].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export function ArtifactList({
  selectedRunId,
  artifacts
}: ArtifactListProps) {
  const orderedArtifacts = sortArtifacts(artifacts);

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Artifacts
          </p>
          <h2 className="font-serif text-xl tracking-tight text-ink">
            Execution artifacts
          </h2>
          <p className="text-sm leading-6 text-muted">
            Files persisted for the selected run land here as the execution service
            emits artifact events.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={orderedArtifacts.length > 0 ? "emerald" : "slate"}>
            {orderedArtifacts.length} artifact
            {orderedArtifacts.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {!selectedRunId ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-shell px-5 py-8 text-sm leading-6 text-muted">
          Start or select a run to inspect its persisted artifacts.
        </div>
      ) : orderedArtifacts.length === 0 ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-shell px-5 py-8 text-sm leading-6 text-muted">
          No artifacts have been persisted for this run yet.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orderedArtifacts.map((artifact) => (
            <li
              key={artifact.id}
              className="rounded-[1.5rem] border border-panel-line bg-surface-elevated px-5 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ink">
                    {artifact.relativePath}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    {artifact.kind} artifact
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {artifact.stepId ? (
                    <Badge variant="slate" size="sm">
                      {artifact.stepId}
                    </Badge>
                  ) : null}
                  <Badge variant="emerald" size="sm">
                    {artifact.size} B
                  </Badge>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
