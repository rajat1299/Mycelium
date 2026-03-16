import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RunTimeline } from "./run-timeline";

const eventStream = vi.hoisted(() => ({
  handlers: new Set<(event: any) => void>()
}));

vi.mock("../../lib/events", () => ({
  subscribeToOutcomeEvents: (
    _outcomeId: string,
    handler: (event: unknown) => void
  ) => {
    const typedHandler = handler as (event: any) => void;
    eventStream.handlers.add(typedHandler);

    return () => {
      eventStream.handlers.delete(typedHandler);
    };
  }
}));

afterEach(() => {
  cleanup();
  eventStream.handlers.clear();
});

describe("RunTimeline routing", () => {
  it("renders provider, model, and auth profile badges when route metadata is available", () => {
    render(
      <RunTimeline
        outcomeId="outcome_123"
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "queued",
          createdAt: "2026-03-14T00:00:00.000Z",
          updatedAt: "2026-03-14T00:00:00.000Z",
          steps: [
            {
              id: "step_1",
              runId: "run_123",
              planNodeId: "node_analyze",
              title: "Analyze outcome",
              kind: "root",
              capability: "reasoning",
              routeProviderId: "anthropic",
              routeModelId: "claude-opus-4.6",
              routeAuthProfileId: "profile_anthropic_primary",
              routePolicyVersion: 1,
              routeStatus: "resolved",
              routeReason: null,
              routeResolvedAt: "2026-03-14T00:00:00.000Z",
              status: "ready",
              position: 0,
              createdAt: "2026-03-14T00:00:00.000Z",
              updatedAt: "2026-03-14T00:00:00.000Z"
            }
          ]
        }}
        authProfiles={[
          {
            id: "profile_anthropic_primary",
            workspaceId: "ws_default",
            providerId: "anthropic",
            label: "Anthropic Primary",
            credentialId: "cred_anthropic_primary",
            status: "active",
            priority: 1,
            cooldownUntil: null,
            lastValidatedAt: null,
            createdAt: "2026-03-14T00:00:00.000Z",
            updatedAt: "2026-03-14T00:00:00.000Z"
          }
        ]}
      />
    );

    expect(screen.getByText("anthropic")).toBeInTheDocument();
    expect(screen.getByText("claude-opus-4.6")).toBeInTheDocument();
    expect(screen.getByText("Anthropic Primary")).toBeInTheDocument();
  });

  it("renders a warning state when a step route is unresolved", () => {
    render(
      <RunTimeline
        outcomeId="outcome_123"
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "queued",
          createdAt: "2026-03-14T00:00:00.000Z",
          updatedAt: "2026-03-14T00:00:00.000Z",
          steps: [
            {
              id: "step_1",
              runId: "run_123",
              planNodeId: "node_analyze",
              title: "Analyze outcome",
              kind: "root",
              capability: "reasoning",
              routeProviderId: "anthropic",
              routeModelId: "claude-opus-4.6",
              routeAuthProfileId: null,
              routePolicyVersion: 2,
              routeStatus: "missing_auth",
              routeReason: "no_active_auth_profile",
              routeResolvedAt: "2026-03-14T00:00:00.000Z",
              status: "ready",
              position: 0,
              createdAt: "2026-03-14T00:00:00.000Z",
              updatedAt: "2026-03-14T00:00:00.000Z"
            }
          ]
        }}
        authProfiles={[]}
      />
    );

    expect(screen.getByText("Missing auth")).toBeInTheDocument();
    expect(screen.getByText("No active auth profile")).toBeInTheDocument();
  });

  it("updates the pinned run status when interruption and resume events arrive", () => {
    render(
      <RunTimeline
        outcomeId="outcome_123"
        initialRun={{
          id: "run_123",
          outcomeId: "outcome_123",
          planId: "plan_outcome_123",
          status: "interrupted",
          latestCheckpointId: "checkpoint_1",
          resumable: true,
          createdAt: "2026-03-16T00:00:00.000Z",
          updatedAt: "2026-03-16T00:00:00.000Z",
          steps: []
        }}
      />
    );

    expect(screen.getByText("interrupted")).toBeInTheDocument();

    act(() => {
      for (const handler of eventStream.handlers) {
        handler({
          outcomeId: "outcome_123",
          type: "run.resumed",
          data: {
            run: {
              id: "run_123",
              outcomeId: "outcome_123",
              planId: "plan_outcome_123",
              status: "running",
              latestCheckpointId: "checkpoint_2",
              resumable: false,
              createdAt: "2026-03-16T00:00:00.000Z",
              updatedAt: "2026-03-16T00:05:00.000Z"
            },
            resumedFromCheckpointId: "checkpoint_2"
          }
        });
      }
    });

    expect(screen.getByText("running")).toBeInTheDocument();
  });
});
