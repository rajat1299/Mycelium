"use client";

import type { Artifact, ArtifactLineageEdge } from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type ArtifactLineagePanelProps = {
  selectedRunId: string | null;
  artifacts: Artifact[];
  edges: ArtifactLineageEdge[];
};

function sortEdges(edges: ArtifactLineageEdge[]) {
  return [...edges].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function ArtifactLineagePanel({
  selectedRunId,
  artifacts,
  edges
}: ArtifactLineagePanelProps) {
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const orderedEdges = sortEdges(edges);

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Lineage
          </p>
          <h2 className="font-serif text-3xl tracking-tight text-ink">
            Artifact lineage
          </h2>
          <p className="text-sm leading-6 text-muted">
            Derived outputs stay readable as a simple chain of parent-to-child edges.
          </p>
        </div>
        <Badge variant={orderedEdges.length > 0 ? "sky" : "slate"}>
          {orderedEdges.length} edge{orderedEdges.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {!selectedRunId ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-white/55 px-5 py-8 text-sm leading-6 text-muted">
          Select a run to inspect artifact lineage.
        </div>
      ) : orderedEdges.length === 0 ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-white/55 px-5 py-8 text-sm leading-6 text-muted">
          No derived-from relationships were persisted for this run yet.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orderedEdges.map((edge) => {
            const parent = artifactById.get(edge.parentArtifactId);
            const child = artifactById.get(edge.childArtifactId);

            return (
              <li
                key={edge.id}
                className="rounded-[1.5rem] border border-panel-line bg-white/78 px-5 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-ink">
                      {child?.relativePath ?? edge.childArtifactId}
                    </p>
                    <p className="text-sm leading-6 text-muted">
                      derived from {parent?.relativePath ?? edge.parentArtifactId}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="slate" size="sm">
                      {edge.parentStepId}
                    </Badge>
                    <Badge variant="sky" size="sm">
                      {edge.childStepId}
                    </Badge>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
