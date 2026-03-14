import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { RunDetailSchema } from "@computer-oss/protocol";
import { createInMemoryRepositories } from "../src/lib/repositories";
import type { Repositories } from "../src/lib/repositories";
import {
  createExecutionHarness,
  createOutcomeAndPlan
} from "./execution-test-helpers";

const ROUTING_TIMESTAMP = "2026-03-14T00:00:00.000Z";

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

async function createTrackingWorkspaceManager() {
  const rootPath = await mkdtemp(
    resolve(tmpdir(), "mycelium-execution-workspace-")
  );
  const leases = new Set<string>();

  return {
    async acquire(runId: string) {
      const runRootPath = resolve(rootPath, runId);
      const inputPath = resolve(runRootPath, "input");
      const artifactsPath = resolve(runRootPath, "artifacts");
      const logsPath = resolve(runRootPath, "logs");

      leases.add(runId);
      await Promise.all([
        mkdir(inputPath, { recursive: true }),
        mkdir(artifactsPath, { recursive: true }),
        mkdir(logsPath, { recursive: true })
      ]);

      return {
        runId,
        acquiredAt: new Date("2026-03-12T00:10:00.000Z").toISOString(),
        paths: {
          rootPath: runRootPath,
          inputPath,
          artifactsPath,
          logsPath
        }
      };
    },
    release(runId: string) {
      leases.delete(runId);
    },
    isLeased(runId: string) {
      return leases.has(runId);
    },
    async cleanup() {
      await rm(rootPath, { recursive: true, force: true });
    }
  };
}

function createBackgroundTransitionFailureRepositories() {
  const repositories = createInMemoryRepositories();
  const error = new Error("background lifecycle transition failed");

  return {
    repositories: {
      ...repositories,
      outcomes: {
        ...repositories.outcomes,
        async updateStatus(
          input: Parameters<typeof repositories.outcomes.updateStatus>[0]
        ) {
          if (input.status !== "queued") {
            throw error;
          }

          return repositories.outcomes.updateStatus(input);
        }
      },
      runs: {
        ...repositories.runs,
        async updateLifecycleStatus(
          _input: Parameters<typeof repositories.runs.updateLifecycleStatus>[0]
        ) {
          throw error;
        }
      }
    } as never,
    error
  };
}

describe("execution service", () => {
  it("runs ready sibling steps before synthesis and emits logs plus artifacts", async () => {
    const startedSiblingNodeIds = new Set<string>();
    let releaseSiblings: (() => void) | null = null;
    const siblingsStarted = new Promise<void>((resolve) => {
      releaseSiblings = resolve;
    });
    const harness = await createExecutionHarness({
      async onExecute(request) {
        if (
          request.step.planNodeId.endsWith("draft-brief") ||
          request.step.planNodeId.endsWith("draft-operator-summary")
        ) {
          startedSiblingNodeIds.add(request.step.planNodeId);

          if (startedSiblingNodeIds.size === 2) {
            releaseSiblings?.();
          }

          await siblingsStarted;
        }

        return {
          stdout: `completed ${request.step.planNodeId}\n`
        };
      }
    });

    try {
      const { app, services, events, fakeSandbox } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(app);

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });
      const createdRun = RunDetailSchema.parse(createRun.json());

      await services.executionService.waitForRun(createdRun.id);

      const started = fakeSandbox.startedPlanNodeIds;
      const briefIndex = started.findIndex((planNodeId) =>
        planNodeId.endsWith("draft-brief")
      );
      const summaryIndex = started.findIndex((planNodeId) =>
        planNodeId.endsWith("draft-operator-summary")
      );
      const synthesisIndex = started.findIndex((planNodeId) =>
        planNodeId.endsWith("synthesize-result")
      );

      expect(started[0]?.endsWith("analyze-outcome")).toBe(true);
      expect(briefIndex).toBeGreaterThan(0);
      expect(summaryIndex).toBeGreaterThan(0);
      expect(briefIndex).toBeLessThan(synthesisIndex);
      expect(summaryIndex).toBeLessThan(synthesisIndex);

      await expect(services.repositories.runs.getById(createdRun.id)).resolves.toEqual(
        expect.objectContaining({
          id: createdRun.id,
          status: "completed"
        })
      );
      await expect(
        services.repositories.outcomes.getById(outcome.id)
      ).resolves.toEqual(
        expect.objectContaining({
          id: outcome.id,
          status: "completed"
        })
      );
      const artifacts = await services.repositories.artifacts.listByRun(createdRun.id);

      expect(artifacts).toHaveLength(4);
      expect(artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            relativePath: "artifacts/analyze-outcome.md",
            kind: "analysis"
          }),
          expect.objectContaining({
            relativePath: "artifacts/brief.md",
            kind: "brief"
          }),
          expect.objectContaining({
            relativePath: "artifacts/operator-summary.md",
            kind: "operator_summary"
          }),
          expect.objectContaining({
            relativePath: "artifacts/final-result.md",
            kind: "result"
          })
        ])
      );

      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "run.log",
            data: expect.objectContaining({
              runId: createdRun.id,
              message: expect.stringContaining("completed")
            })
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "artifact.created",
            data: expect.objectContaining({
              runId: createdRun.id,
              relativePath: "artifacts/final-result.md"
            })
          })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("keeps the local execution path running when persisted route metadata is unresolved", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(
        app,
        "Local execution should ignore unresolved route metadata in M4."
      );
      await seedMissingAuthRouting(services.repositories, outcome.workspaceId);

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });
      const createdRun = RunDetailSchema.parse(createRun.json());

      await expect(
        services.executionService.waitForRun(createdRun.id)
      ).resolves.toBeUndefined();
      await expect(services.repositories.runs.getById(createdRun.id)).resolves.toEqual(
        expect.objectContaining({
          id: createdRun.id,
          status: "completed"
        })
      );
      await expect(services.repositories.runs.listSteps(createdRun.id)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Analyze outcome",
            routeStatus: "missing_auth",
            routeReason: "no_active_auth_profile"
          }),
          expect.objectContaining({
            title: "Synthesize result",
            routeStatus: "missing_auth",
            routeReason: "no_active_auth_profile"
          })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("fails the run and clears the local workspace when durable lease acquisition fails", async () => {
    const workspaceManager = await createTrackingWorkspaceManager();
    const repositories = createInMemoryRepositories();
    const harness = await createExecutionHarness({
      repositories: {
        ...repositories,
        workspaceLeases: {
          ...repositories.workspaceLeases,
          async acquire() {
            throw new Error("lease insert failed");
          }
        }
      },
      workspaceManager
    });

    try {
      const { app, services, events } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(app);

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });
      const createdRun = RunDetailSchema.parse(createRun.json());

      await expect(
        services.executionService.waitForRun(createdRun.id)
      ).resolves.toBeUndefined();
      expect(workspaceManager.isLeased(createdRun.id)).toBe(false);
      await expect(
        services.repositories.workspaceLeases.getActiveByRun(createdRun.id)
      ).resolves.toBeNull();
      await expect(services.repositories.runs.getById(createdRun.id)).resolves.toEqual(
        expect.objectContaining({
          id: createdRun.id,
          status: "failed"
        })
      );
      await expect(
        services.repositories.outcomes.getById(outcome.id)
      ).resolves.toEqual(
        expect.objectContaining({
          id: outcome.id,
          status: "failed"
        })
      );
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "run.log",
            data: expect.objectContaining({
              runId: createdRun.id,
              level: "error",
              message: expect.stringContaining("lease insert failed")
            })
          })
        ])
      );
    } finally {
      await harness.cleanup();
      await workspaceManager.cleanup();
    }
  });

  it("keeps the run completed and clears the local workspace when durable lease release fails", async () => {
    const workspaceManager = await createTrackingWorkspaceManager();
    const repositories = createInMemoryRepositories();
    const harness = await createExecutionHarness({
      repositories: {
        ...repositories,
        workspaceLeases: {
          ...repositories.workspaceLeases,
          async release() {
            throw new Error("lease release failed");
          }
        }
      },
      workspaceManager
    });

    try {
      const { app, services, events } = harness;
      const { outcome, plan } = await createOutcomeAndPlan(app);

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });
      const createdRun = RunDetailSchema.parse(createRun.json());

      await expect(
        services.executionService.waitForRun(createdRun.id)
      ).resolves.toBeUndefined();
      expect(workspaceManager.isLeased(createdRun.id)).toBe(false);
      await expect(services.repositories.runs.getById(createdRun.id)).resolves.toEqual(
        expect.objectContaining({
          id: createdRun.id,
          status: "completed"
        })
      );
      await expect(
        services.repositories.outcomes.getById(outcome.id)
      ).resolves.toEqual(
        expect.objectContaining({
          id: outcome.id,
          status: "completed"
        })
      );
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "run.log",
            data: expect.objectContaining({
              runId: createdRun.id,
              level: "error",
              message: expect.stringContaining("lease release failed")
            })
          })
        ])
      );
    } finally {
      await harness.cleanup();
      await workspaceManager.cleanup();
    }
  });

  it("surfaces unexpected background execution crashes through waitForRun", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { repositories, error } = createBackgroundTransitionFailureRepositories();
    const harness = await createExecutionHarness({
      repositories
    });

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
      const createdRun = RunDetailSchema.parse(createRun.json());

      await expect(services.executionService.waitForRun(createdRun.id)).rejects.toThrow(
        error.message
      );
    } finally {
      consoleErrorSpy.mockRestore();
      await harness.cleanup();
    }
  });

  it("keeps run and outcome lifecycle state aligned when a background transition crashes", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { repositories, error } = createBackgroundTransitionFailureRepositories();
    const harness = await createExecutionHarness({
      repositories
    });

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
      const createdRun = RunDetailSchema.parse(createRun.json());

      await expect(services.executionService.waitForRun(createdRun.id)).rejects.toThrow(
        error.message
      );
      await expect(services.repositories.runs.getById(createdRun.id)).resolves.toEqual(
        expect.objectContaining({
          id: createdRun.id,
          status: "queued"
        })
      );
      await expect(
        services.repositories.outcomes.getById(outcome.id)
      ).resolves.toEqual(
        expect.objectContaining({
          id: outcome.id,
          status: "queued"
        })
      );
    } finally {
      consoleErrorSpy.mockRestore();
      await harness.cleanup();
    }
  });
});
