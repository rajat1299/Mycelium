import { describe, expect, it } from "vitest";
import {
  OutcomeSchema,
  RunDetailSchema,
  RunLogListResponseSchema
} from "@computer-oss/protocol";
import type { Repositories } from "../src/lib/repositories";
import {
  createExecutionHarness,
  createOutcomeAndPlan
} from "./execution-test-helpers";

const ROUTING_TIMESTAMP = "2026-03-14T00:00:00.000Z";

async function seedResolvedRouting(repositories: Repositories, workspaceId: string) {
  await repositories.workspaceCredentials.create({
    id: "cred_anthropic_primary",
    workspaceId,
    providerId: "anthropic",
    label: "Anthropic Primary",
    secretCiphertext: "ciphertext",
    secretNonce: "nonce",
    secretVersion: 1,
    status: "active",
    createdAt: ROUTING_TIMESTAMP,
    updatedAt: ROUTING_TIMESTAMP,
    lastValidatedAt: null
  });
  await repositories.authProfiles.create({
    id: "profile_anthropic_primary",
    workspaceId,
    providerId: "anthropic",
    label: "Anthropic Primary",
    credentialId: "cred_anthropic_primary",
    priority: 1,
    status: "active",
    cooldownUntil: null,
    lastValidatedAt: ROUTING_TIMESTAMP,
    createdAt: ROUTING_TIMESTAMP,
    updatedAt: ROUTING_TIMESTAMP
  });
  await repositories.routerPolicy.upsert({
    workspaceId,
    version: 1,
    updatedAt: ROUTING_TIMESTAMP,
    candidates: [
      {
        capability: "reasoning",
        priority: 0,
        providerId: "anthropic",
        modelId: "claude-opus-4.6",
        authProfileId: "profile_anthropic_primary",
        enabled: true
      },
      {
        capability: "document",
        priority: 0,
        providerId: "anthropic",
        modelId: "claude-opus-4.6",
        authProfileId: "profile_anthropic_primary",
        enabled: true
      }
    ]
  });
}

async function seedMissingAuthRouting(repositories: Repositories, workspaceId: string) {
  await repositories.routerPolicy.upsert({
    workspaceId,
    version: 2,
    updatedAt: ROUTING_TIMESTAMP,
    candidates: [
      {
        capability: "reasoning",
        priority: 0,
        providerId: "anthropic",
        modelId: "claude-opus-4.6",
        authProfileId: null,
        enabled: true
      },
      {
        capability: "document",
        priority: 0,
        providerId: "anthropic",
        modelId: "claude-opus-4.6",
        authProfileId: null,
        enabled: true
      }
    ]
  });
}

describe("run routes", () => {
  it("creates a run, returns the queued snapshot, and execution completes in the background", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(app);

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });

      expect(createRun.statusCode).toBe(201);
      const run = RunDetailSchema.parse(createRun.json());

      expect(run.planId).toBe(plan.id);
      expect(run.status).toBe("queued");
      expect(run.steps).toEqual([
        expect.objectContaining({
          title: "Analyze outcome",
          status: "ready",
          instruction: "Inspect the outcome prompt and capture execution notes.",
          template: "analyze_outcome",
          expectedArtifactPath: "artifacts/analyze-outcome.md",
          expectedArtifactKind: "analysis"
        }),
        expect.objectContaining({
          title: "Draft brief",
          status: "pending",
          expectedArtifactPath: "artifacts/brief.md",
          expectedArtifactKind: "brief"
        }),
        expect.objectContaining({
          title: "Draft operator summary",
          status: "pending",
          expectedArtifactPath: "artifacts/operator-summary.md",
          expectedArtifactKind: "operator_summary"
        }),
        expect.objectContaining({
          title: "Synthesize result",
          status: "pending",
          expectedArtifactPath: "artifacts/final-result.md",
          expectedArtifactKind: "result"
        })
      ]);

      await services.executionService.waitForRun(run.id);

      const readRun = await app.inject({
        method: "GET",
        url: `/api/runs/${run.id}`
      });

      expect(readRun.statusCode).toBe(200);
      expect(RunDetailSchema.parse(readRun.json())).toEqual(
        expect.objectContaining({
          id: run.id,
          status: "completed",
          steps: [
            expect.objectContaining({
              title: "Analyze outcome",
              status: "completed"
            }),
            expect.objectContaining({
              title: "Draft brief",
              status: "completed"
            }),
            expect.objectContaining({
              title: "Draft operator summary",
              status: "completed"
            }),
            expect.objectContaining({
              title: "Synthesize result",
              status: "completed"
            })
          ]
        })
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("persists resolved step-route metadata on run creation and includes it in run detail responses", async () => {
    const harness = await createExecutionHarness();
    let createdRunId: string | null = null;

    try {
      const { app, services } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(
        app,
        "Persist resolved route metadata on each run step."
      );
      await seedResolvedRouting(services.repositories, outcome.workspaceId);

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });

      expect(createRun.statusCode).toBe(201);
      const run = RunDetailSchema.parse(createRun.json());
      createdRunId = run.id;

      expect(run.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Analyze outcome",
            routeProviderId: "anthropic",
            routeModelId: "claude-opus-4.6",
            routeAuthProfileId: "profile_anthropic_primary",
            routePolicyVersion: 1,
            routeStatus: "resolved",
            routeReason: null,
            routeResolvedAt: expect.any(String)
          }),
          expect.objectContaining({
            title: "Synthesize result",
            routeProviderId: "anthropic",
            routeModelId: "claude-opus-4.6",
            routeAuthProfileId: "profile_anthropic_primary",
            routePolicyVersion: 1,
            routeStatus: "resolved",
            routeReason: null,
            routeResolvedAt: expect.any(String)
          })
        ])
      );

      const readRun = await app.inject({
        method: "GET",
        url: `/api/runs/${run.id}`
      });

      expect(readRun.statusCode).toBe(200);
      expect(RunDetailSchema.parse(readRun.json()).steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Draft brief",
            routeProviderId: "anthropic",
            routeModelId: "claude-opus-4.6",
            routeAuthProfileId: "profile_anthropic_primary",
            routePolicyVersion: 1,
            routeStatus: "resolved",
            routeReason: null,
            routeResolvedAt: expect.any(String)
          })
        ])
      );
    } finally {
      if (createdRunId) {
        await harness.services.executionService.waitForRun(createdRunId);
      }

      await harness.cleanup();
    }
  });

  it("persists unresolved missing-auth diagnostics on run steps when no auth profile is available", async () => {
    const harness = await createExecutionHarness();
    let createdRunId: string | null = null;

    try {
      const { app, services } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(
        app,
        "Persist unresolved route diagnostics when auth is missing."
      );
      await seedMissingAuthRouting(services.repositories, outcome.workspaceId);

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });

      expect(createRun.statusCode).toBe(201);
      const run = RunDetailSchema.parse(createRun.json());
      createdRunId = run.id;

      expect(run.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Analyze outcome",
            routeProviderId: "anthropic",
            routeModelId: "claude-opus-4.6",
            routeAuthProfileId: null,
            routePolicyVersion: 2,
            routeStatus: "missing_auth",
            routeReason: "no_active_auth_profile",
            routeResolvedAt: expect.any(String)
          }),
          expect.objectContaining({
            title: "Draft operator summary",
            routeProviderId: "anthropic",
            routeModelId: "claude-opus-4.6",
            routeAuthProfileId: null,
            routePolicyVersion: 2,
            routeStatus: "missing_auth",
            routeReason: "no_active_auth_profile",
            routeResolvedAt: expect.any(String)
          })
        ])
      );
    } finally {
      if (createdRunId) {
        await harness.services.executionService.waitForRun(createdRunId);
      }

      await harness.cleanup();
    }
  });

  it("returns the latest persisted run for an outcome", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(
        app,
        "Re-open the queued execution timeline."
      );

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });

      const createdRun = RunDetailSchema.parse(createRun.json());
      await services.executionService.waitForRun(createdRun.id);

      const latestRun = await app.inject({
        method: "GET",
        url: `/api/outcomes/${outcome.id}/runs/latest`
      });

      expect(latestRun.statusCode).toBe(200);
      expect(RunDetailSchema.parse(latestRun.json())).toEqual(
        expect.objectContaining({
          id: createdRun.id,
          status: "completed"
        })
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("publishes queued, running, and completed lifecycle events when a run is created", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services, events } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(
        app,
        "Prepare the launch follow-up tasks."
      );

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });

      const createdRun = RunDetailSchema.parse(createRun.json());
      await services.executionService.waitForRun(createdRun.id);

      const readOutcome = await app.inject({
        method: "GET",
        url: `/api/outcomes/${outcome.id}`
      });

      expect(readOutcome.statusCode).toBe(200);
      expect(OutcomeSchema.parse(readOutcome.json()).status).toBe("completed");

      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "outcome.updated",
            data: expect.objectContaining({
              id: outcome.id,
              status: "queued"
            })
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "outcome.updated",
            data: expect.objectContaining({
              id: outcome.id,
              status: "running"
            })
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "outcome.updated",
            data: expect.objectContaining({
              id: outcome.id,
              status: "completed"
            })
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "run.created",
            data: expect.objectContaining({
              id: createdRun.id,
              outcomeId: outcome.id,
              planId: plan.id
            })
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "run.updated",
            data: expect.objectContaining({
              id: createdRun.id,
              status: "running"
            })
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "run.updated",
            data: expect.objectContaining({
              id: createdRun.id,
              status: "completed"
            })
          })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("lists persisted run logs for a completed run", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(
        app,
        "Reopen the operator log panel after execution."
      );

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });
      const createdRun = RunDetailSchema.parse(createRun.json());

      await services.executionService.waitForRun(createdRun.id);

      const readLogs = await app.inject({
        method: "GET",
        url: `/api/runs/${createdRun.id}/logs`
      });

      expect(readLogs.statusCode).toBe(200);
      const payload = RunLogListResponseSchema.parse(readLogs.json());

      expect(payload.logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            runId: createdRun.id,
            level: "info",
            stepTitle: "Analyze outcome",
            message: "Starting Analyze outcome"
          }),
          expect.objectContaining({
            runId: createdRun.id,
            level: "info",
            stepTitle: "Synthesize result",
            message: "Completed Synthesize result"
          })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });
});
