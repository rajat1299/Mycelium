import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditTrail } from "./audit-trail";

describe("AuditTrail", () => {
  it("renders audit events in ascending sequence order", () => {
    render(
      <AuditTrail
        selectedRunId="run_123"
        events={[
          {
            id: "audit_2",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: "step_final",
            checkpointId: "checkpoint_3",
            sequence: 2,
            category: "checkpoint",
            eventType: "checkpoint.created",
            actorType: "system",
            summary: "Checkpoint #3 captured after synthesis completed.",
            payload: {},
            createdAt: "2026-03-16T12:05:00.000Z"
          },
          {
            id: "audit_1",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: null,
            checkpointId: null,
            sequence: 1,
            category: "lifecycle",
            eventType: "run.started",
            actorType: "system",
            summary: "Run started.",
            payload: {},
            createdAt: "2026-03-16T12:00:00.000Z"
          },
          {
            id: "audit_3",
            workspaceId: "ws_default",
            outcomeId: "outcome_123",
            runId: "run_123",
            stepId: null,
            checkpointId: "checkpoint_3",
            sequence: 3,
            category: "resume",
            eventType: "run.interrupted",
            actorType: "system",
            summary: "Run marked interrupted from checkpoint #3.",
            payload: {},
            createdAt: "2026-03-16T12:06:00.000Z"
          }
        ]}
      />
    );

    const items = screen.getAllByRole("listitem");

    expect(within(items[0]).getByText("#1")).toBeInTheDocument();
    expect(within(items[1]).getByText("#2")).toBeInTheDocument();
    expect(within(items[2]).getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Run marked interrupted from checkpoint #3.")).toBeInTheDocument();
  });
});
