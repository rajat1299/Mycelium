"use client";

import { useState } from "react";
import type { Approval, Artifact } from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type ReviewDetailCardProps = {
  approval: Approval | null;
  artifacts: Artifact[];
  onResolved?: (approvalId: string) => void;
};

function readErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

export function ReviewDetailCard({
  approval,
  artifacts,
  onResolved
}: ReviewDetailCardProps) {
  const [statusMessage, setStatusMessage] = useState<{
    tone: "default" | "error";
    text: string;
  } | null>(null);
  const [inFlightAction, setInFlightAction] = useState<"approve" | "reject" | null>(
    null
  );

  if (!approval) {
    return (
      <section className="rounded-[2rem] border border-dashed border-panel-line bg-white/60 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
          Review detail
        </p>
        <h2 className="mt-2 font-serif text-3xl tracking-tight text-ink">
          No pending approvals
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          When a run blocks for output review, the selected approval and its artifact
          context will appear here.
        </p>
      </section>
    );
  }

  const activeApproval = approval;

  async function submitResolution(action: "approve" | "reject") {
    setInFlightAction(action);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/approvals/${activeApproval.id}/${action}`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          resolutionNote: null
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          readErrorMessage(
            payload,
            action === "approve"
              ? "Failed to approve pending review."
              : "Failed to reject pending review."
          )
        );
      }

      setStatusMessage({
        tone: "default",
        text:
          action === "approve"
            ? "Approval recorded. Queue state will refresh from live events."
            : "Rejection recorded. Queue state will refresh from live events."
      });
      onResolved?.(activeApproval.id);
    } catch (error) {
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : action === "approve"
              ? "Failed to approve pending review."
              : "Failed to reject pending review."
      });
    } finally {
      setInFlightAction(null);
    }
  }

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Review detail
          </p>
          <h2 className="font-serif text-3xl tracking-tight text-ink">
            {activeApproval.title}
          </h2>
          <p className="text-sm leading-6 text-muted">
            {activeApproval.summary ?? "This run is waiting for operator review."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="amber">pending</Badge>
          <Badge variant="slate">run {activeApproval.runId}</Badge>
        </div>
      </div>

      <div className="mt-5 rounded-[1.5rem] bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Operator instruction
        </p>
        <p className="mt-3 text-sm leading-6 text-ink">
          {activeApproval.instruction ??
            "Approve to continue this run or reject to fail it."}
        </p>
        <p className="mt-3 text-xs text-muted">
          Requested {new Date(activeApproval.requestedAt).toLocaleString()}
        </p>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Artifacts under review
          </p>
          <Badge variant="slate" size="sm">
            {artifacts.length} artifact{artifacts.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {artifacts.length === 0 ? (
          <div className="mt-3 rounded-[1.5rem] border border-dashed border-panel-line bg-white/60 p-5 text-sm leading-6 text-muted">
            No persisted artifacts were loaded for this approval yet.
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {artifacts.map((artifact) => (
              <li
                key={artifact.id}
                className="rounded-[1.5rem] border border-panel-line bg-white/78 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-ink">
                      {artifact.relativePath}
                    </p>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">
                      {artifact.kind}
                    </p>
                  </div>
                  <Badge variant="emerald" size="sm">
                    {artifact.size} B
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <a
          href={`/outcomes/${activeApproval.outcomeId}?runId=${activeApproval.runId}`}
          className="rounded-full border border-panel-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
        >
          Open outcome
        </a>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => submitResolution("reject")}
            disabled={inFlightAction !== null}
            className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {inFlightAction === "reject" ? "Rejecting" : "Reject"}
          </button>
          <button
            type="button"
            onClick={() => submitResolution("approve")}
            disabled={inFlightAction !== null}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {inFlightAction === "approve" ? "Approving" : "Approve"}
          </button>
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
