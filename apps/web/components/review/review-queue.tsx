"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  ApprovalListResponseSchema,
  ArtifactListResponseSchema,
  type Approval,
  type Artifact
} from "@computer-oss/protocol";
import { subscribeToOutcomeEvents } from "../../lib/events";
import { Badge } from "../ui/badge";
import { ReviewDetailCard } from "./review-detail-card";

type ReviewQueueProps = {
  workspaceId: string;
  initialApprovals: Approval[];
  initialArtifactsByRunId: Record<string, Artifact[]>;
};

function sortApprovals(approvals: Approval[]) {
  return [...approvals].sort((left, right) =>
    right.requestedAt.localeCompare(left.requestedAt)
  );
}

function selectFallbackApproval(
  approvals: Approval[],
  selectedApprovalId: string | null
) {
  if (selectedApprovalId && approvals.some((approval) => approval.id === selectedApprovalId)) {
    return selectedApprovalId;
  }

  return approvals[0]?.id ?? null;
}

function mergeArtifactsByRunId(
  current: Record<string, Artifact[]>,
  runId: string,
  artifacts: Artifact[]
) {
  return {
    ...current,
    [runId]: artifacts
  };
}

function hasAllArtifactIds(
  artifactsByRunId: Record<string, Artifact[]>,
  runId: string,
  artifactIds: string[]
) {
  const artifacts = artifactsByRunId[runId];

  if (!artifacts) {
    return false;
  }

  const artifactIdSet = new Set(artifacts.map((artifact) => artifact.id));
  return artifactIds.every((artifactId) => artifactIdSet.has(artifactId));
}

export function ReviewQueue({
  workspaceId,
  initialApprovals,
  initialArtifactsByRunId
}: ReviewQueueProps) {
  const initialSortedApprovals = sortApprovals(initialApprovals);
  const [approvals, setApprovals] = useState(() => initialSortedApprovals);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(
    initialSortedApprovals[0]?.id ?? null
  );
  const [artifactsByRunId, setArtifactsByRunId] = useState(initialArtifactsByRunId);
  const artifactsByRunIdRef = useRef(initialArtifactsByRunId);
  const loadingRunIdsRef = useRef(new Set<string>());

  async function ensureArtifactsLoaded(runId: string, artifactIds: string[]) {
    if (
      hasAllArtifactIds(artifactsByRunIdRef.current, runId, artifactIds) ||
      loadingRunIdsRef.current.has(runId)
    ) {
      return;
    }

    loadingRunIdsRef.current.add(runId);

    try {
      const response = await fetch(`/api/runs/${runId}/artifacts`, {
        cache: "no-store"
      });

      if (!response.ok) {
        return;
      }

      const payload = ArtifactListResponseSchema.parse(await response.json());

      startTransition(() => {
        setArtifactsByRunId((current) => {
          const next = mergeArtifactsByRunId(current, runId, payload.artifacts);
          artifactsByRunIdRef.current = next;
          return next;
        });
      });
    } catch {
      return;
    } finally {
      loadingRunIdsRef.current.delete(runId);
    }
  }

  async function refreshApprovals() {
    try {
      const response = await fetch(
        `/api/approvals?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        return;
      }

      const payload = ApprovalListResponseSchema.parse(await response.json());
      const nextApprovals = sortApprovals(payload.approvals);

      startTransition(() => {
        setApprovals(nextApprovals);
        setSelectedApprovalId((current) => selectFallbackApproval(nextApprovals, current));
      });

      await Promise.all(
        nextApprovals.map((approval) =>
          ensureArtifactsLoaded(approval.runId, approval.artifactIds)
        )
      );
    } catch {
      return;
    }
  }

  useEffect(() => {
    const nextApprovals = sortApprovals(initialApprovals);
    setApprovals(nextApprovals);
    setSelectedApprovalId((current) => selectFallbackApproval(nextApprovals, current));
    setArtifactsByRunId(initialArtifactsByRunId);
    artifactsByRunIdRef.current = initialArtifactsByRunId;
  }, [initialApprovals, initialArtifactsByRunId]);

  useEffect(() => {
    void refreshApprovals();

    const intervalId = window.setInterval(() => {
      void refreshApprovals();
    }, 5_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [workspaceId]);

  useEffect(() => {
    const outcomeIds = Array.from(new Set(approvals.map((approval) => approval.outcomeId)));

    if (outcomeIds.length === 0) {
      return;
    }

    const unsubscribes = outcomeIds.map((outcomeId) =>
      subscribeToOutcomeEvents(outcomeId, (event) => {
        startTransition(() => {
          if (event.type === "approval.requested" && event.data.workspaceId === workspaceId) {
            setApprovals((current) => {
              const next = current.some((approval) => approval.id === event.data.id)
                ? current.map((approval) =>
                    approval.id === event.data.id ? event.data : approval
                  )
                : sortApprovals([event.data, ...current]);

              setSelectedApprovalId((selected) => selectFallbackApproval(next, selected));
              return sortApprovals(next);
            });
            void ensureArtifactsLoaded(event.data.runId, event.data.artifactIds);
          }

          if (event.type === "approval.resolved") {
            setApprovals((current) => {
              const next = current.filter((approval) => approval.id !== event.data.id);
              setSelectedApprovalId((selected) => selectFallbackApproval(next, selected));
              return next;
            });
          }
        });
      })
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [approvals, workspaceId]);

  const selectedApproval =
    approvals.find((approval) => approval.id === selectedApprovalId) ?? approvals[0] ?? null;
  const selectedArtifacts = useMemo(
    () =>
      selectedApproval
        ? (artifactsByRunId[selectedApproval.runId] ?? []).filter((artifact) =>
            selectedApproval.artifactIds.includes(artifact.id)
          )
        : [],
    [artifactsByRunId, selectedApproval]
  );

  useEffect(() => {
    if (!selectedApproval) {
      return;
    }

    void ensureArtifactsLoaded(selectedApproval.runId, selectedApproval.artifactIds);
  }, [selectedApproval]);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              Pending reviews
            </p>
            <h2 className="font-serif text-xl tracking-tight text-ink">
              Approval queue
            </h2>
            <p className="text-sm leading-6 text-muted">
              Review-required runs pause here until an operator resolves the blocked
              output.
            </p>
          </div>
          <Badge variant={approvals.length > 0 ? "amber" : "slate"}>
            {approvals.length} pending
          </Badge>
        </div>

        {approvals.length === 0 ? (
          <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-shell p-5 text-sm leading-6 text-muted">
            No pending approvals
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {approvals.map((approval, index) => {
              const isSelected = approval.id === selectedApproval?.id;

              return (
                <li key={approval.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedApprovalId(approval.id)}
                    aria-pressed={isSelected}
                    className={[
                      "w-full rounded-[1.6rem] border px-4 py-4 text-left transition",
                      isSelected
                        ? "border-accent/40 bg-accent-soft shadow-[0_18px_40px_var(--accent-soft)]"
                        : "border-panel-line bg-surface-elevated hover:border-accent/30 hover:bg-panel"
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-ink">{approval.title}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted">
                          Run {approval.runId} · step {approval.stepId}
                        </p>
                      </div>
                      <div
                        className="text-xs text-muted"
                        style={{ transitionDelay: `${index * 40}ms` }}
                      >
                        {new Date(approval.requestedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="amber" size="sm">
                        pending
                      </Badge>
                      <Badge variant="slate" size="sm">
                        {approval.artifactIds.length} artifact
                        {approval.artifactIds.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ReviewDetailCard
        approval={selectedApproval}
        artifacts={selectedArtifacts}
        onResolved={(approvalId) => {
          setApprovals((current) => {
            const next = current.filter((approval) => approval.id !== approvalId);
            setSelectedApprovalId(selectFallbackApproval(next, approvalId));
            return next;
          });
        }}
      />
    </div>
  );
}
