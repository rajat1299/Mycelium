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
import {
  createPlanForOutcomeTurn,
  createRunForExistingPlan
} from "./turn-test-helpers";

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

async function createNonReviewPlan(
  repositories: Repositories,
  outcomeId: string
) {
  const createdAt = "2026-03-12T00:00:00.000Z";

  return createPlanForOutcomeTurn(repositories, {
    id: `plan_${outcomeId}_no_review`,
    outcomeId,
    status: "draft",
    createdAt,
    updatedAt: createdAt,
    nodes: [
      {
        id: `plan_${outcomeId}_no_review:analyze-outcome`,
        kind: "root",
        title: "Analyze outcome",
        capability: "reasoning",
        instruction: "Inspect the outcome prompt and capture execution notes.",
        template: "analyze_outcome",
        expectedArtifactPath: "artifacts/analyze-outcome.md",
        expectedArtifactKind: "analysis"
      },
      {
        id: `plan_${outcomeId}_no_review:synthesize-result`,
        kind: "synthesis",
        title: "Synthesize result",
        capability: "document",
        instruction: "Combine the brief and operator summary into the final result.",
        template: "synthesize_result",
        expectedArtifactPath: "artifacts/final-result.md",
        expectedArtifactKind: "result"
      }
    ],
    edges: [
      {
        id: `plan_${outcomeId}_no_review:edge-analyze-synthesize`,
        from: `plan_${outcomeId}_no_review:analyze-outcome`,
        to: `plan_${outcomeId}_no_review:synthesize-result`
      }
    ]
  });
}

async function createReviewBlockedParentPlan(
  repositories: Repositories,
  outcomeId: string
) {
  const createdAt = "2026-03-12T00:00:00.000Z";

  return createPlanForOutcomeTurn(repositories, {
    id: `plan_${outcomeId}_review_parent`,
    outcomeId,
    status: "draft",
    createdAt,
    updatedAt: createdAt,
    nodes: [
      {
        id: `plan_${outcomeId}_review_parent:analyze-outcome`,
        kind: "root",
        title: "Analyze outcome",
        capability: "reasoning",
        instruction: "Inspect the outcome prompt and capture execution notes.",
        template: "analyze_outcome",
        approvalRequirement: {
          kind: "output_review_required",
          title: "Review analysis",
          summary: "Inspect the analysis artifact before the final step runs.",
          instruction: "Approve to release the dependent synthesis step."
        },
        expectedArtifactPath: "artifacts/analyze-outcome.md",
        expectedArtifactKind: "analysis"
      },
      {
        id: `plan_${outcomeId}_review_parent:synthesize-result`,
        kind: "synthesis",
        title: "Synthesize result",
        capability: "document",
        instruction: "Combine the brief and operator summary into the final result.",
        template: "synthesize_result",
        expectedArtifactPath: "artifacts/final-result.md",
        expectedArtifactKind: "result"
      }
    ],
    edges: [
      {
        id: `plan_${outcomeId}_review_parent:edge-analyze-synthesize`,
        from: `plan_${outcomeId}_review_parent:analyze-outcome`,
        to: `plan_${outcomeId}_review_parent:synthesize-result`
      }
    ]
  });
}

async function createMixedBlockedSiblingsPlan(
  repositories: Repositories,
  outcomeId: string
) {
  const createdAt = "2026-03-12T00:00:00.000Z";

  return createPlanForOutcomeTurn(repositories, {
    id: `plan_${outcomeId}_mixed_block`,
    outcomeId,
    status: "draft",
    createdAt,
    updatedAt: createdAt,
    nodes: [
      {
        id: `plan_${outcomeId}_mixed_block:root`,
        kind: "root",
        title: "Analyze outcome",
        capability: "reasoning",
        instruction: "Inspect the outcome prompt and capture execution notes.",
        template: "analyze_outcome",
        expectedArtifactPath: "artifacts/analyze-outcome.md",
        expectedArtifactKind: "analysis"
      },
      {
        id: `plan_${outcomeId}_mixed_block:review-branch`,
        kind: "task",
        title: "Review branch",
        capability: "document",
        instruction: "Draft the reviewable branch artifact.",
        approvalRequirement: {
          kind: "output_review_required",
          title: "Review branch artifact",
          summary: "Approve this branch before any more sibling work runs.",
          instruction: "Approve to resume the blocked run."
        },
        expectedArtifactPath: "artifacts/review-branch.md",
        expectedArtifactKind: "brief"
      },
      {
        id: `plan_${outcomeId}_mixed_block:normal-branch`,
        kind: "task",
        title: "Normal branch",
        capability: "document",
        instruction: "Draft the normal branch artifact.",
        template: "draft_operator_summary",
        expectedArtifactPath: "artifacts/normal-branch.md",
        expectedArtifactKind: "operator_summary"
      },
      {
        id: `plan_${outcomeId}_mixed_block:tail`,
        kind: "synthesis",
        title: "Tail task",
        capability: "document",
        instruction: "Only run after the normal branch completes.",
        template: "synthesize_result",
        expectedArtifactPath: "artifacts/tail.md",
        expectedArtifactKind: "result"
      }
    ],
    edges: [
      {
        id: `plan_${outcomeId}_mixed_block:edge-root-review`,
        from: `plan_${outcomeId}_mixed_block:root`,
        to: `plan_${outcomeId}_mixed_block:review-branch`
      },
      {
        id: `plan_${outcomeId}_mixed_block:edge-root-normal`,
        from: `plan_${outcomeId}_mixed_block:root`,
        to: `plan_${outcomeId}_mixed_block:normal-branch`
      },
      {
        id: `plan_${outcomeId}_mixed_block:edge-normal-tail`,
        from: `plan_${outcomeId}_mixed_block:normal-branch`,
        to: `plan_${outcomeId}_mixed_block:tail`
      }
    ]
  });
}

describe("execution service", () => {
  it("blocks the run after the review-required synthesis step, creates an approval, and records lineage edges", async () => {
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
          status: "blocked"
        })
      );
      await expect(
        services.repositories.outcomes.getById(outcome.id)
      ).resolves.toEqual(
        expect.objectContaining({
          id: outcome.id,
          status: "blocked_on_approval"
        })
      );
      await expect(services.repositories.runs.listSteps(createdRun.id)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Synthesize result",
            status: "blocked",
            approvalRequirement: {
              kind: "output_review_required",
              title: "Review final result",
              summary: "Inspect the final artifact before marking the run complete.",
              instruction: "Approve to complete the run or reject to fail it."
            }
          })
        ])
      );

      await expect(
        services.repositories.approvals.listByWorkspace({
          workspaceId: outcome.workspaceId,
          status: "pending"
        })
      ).resolves.toEqual([
        expect.objectContaining({
          workspaceId: outcome.workspaceId,
          outcomeId: outcome.id,
          runId: createdRun.id,
          status: "pending",
          kind: "output_review_required",
          artifactIds: expect.arrayContaining([expect.any(String)])
        })
      ]);

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
      await expect(
        services.repositories.artifactLineage.listByRun(createdRun.id)
      ).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            relation: "derived_from",
            childStepId: expect.stringContaining("draft-brief")
          }),
          expect.objectContaining({
            relation: "derived_from",
            childStepId: expect.stringContaining("draft-operator-summary")
          }),
          expect.objectContaining({
            relation: "derived_from",
            childStepId: expect.stringContaining("synthesize-result")
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
          }),
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "approval.requested",
            data: expect.objectContaining({
              runId: createdRun.id,
              status: "pending"
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
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Local execution should ignore unresolved route metadata in M4.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();
      const plan = await createNonReviewPlan(services.repositories, outcome.id);
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

  it("stops scheduling additional ready work once any branch blocks on approval", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services, fakeSandbox } = harness;
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Block one branch and make sure sibling-ready work stops.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();
      const plan = await createMixedBlockedSiblingsPlan(
        services.repositories,
        outcome.id
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

      expect(fakeSandbox.startedPlanNodeIds).toEqual(
        expect.arrayContaining([
          expect.stringContaining(":root"),
          expect.stringContaining(":review-branch"),
          expect.stringContaining(":normal-branch")
        ])
      );
      expect(fakeSandbox.startedPlanNodeIds).not.toEqual(
        expect.arrayContaining([expect.stringContaining(":tail")])
      );
      await expect(services.repositories.runs.getById(createdRun.id)).resolves.toEqual(
        expect.objectContaining({
          id: createdRun.id,
          status: "blocked"
        })
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("resumes already-ready sibling work after approving a blocked branch", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services, fakeSandbox } = harness;
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Resume sibling-ready work after approval.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();
      const plan = await createMixedBlockedSiblingsPlan(
        services.repositories,
        outcome.id
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

      await expect(services.repositories.runs.listSteps(createdRun.id)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Tail task",
            status: "ready"
          }),
          expect.objectContaining({
            title: "Review branch",
            status: "blocked"
          })
        ])
      );

      const [approval] = await services.repositories.approvals.listByWorkspace({
        workspaceId: outcome.workspaceId,
        status: "pending"
      });

      await services.approvalService.resolveApproval({
        approvalId: approval.id,
        resolution: "approved",
        resolutionNote: "Resume."
      });

      await services.executionService.waitForRun(createdRun.id);

      expect(fakeSandbox.startedPlanNodeIds).toEqual(
        expect.arrayContaining([expect.stringContaining(":tail")])
      );
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
    } finally {
      await harness.cleanup();
    }
  });

  it("approves blocked review-required work and completes the run", async () => {
    const harness = await createExecutionHarness();

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

      await services.executionService.waitForRun(createdRun.id);

      const [approval] = await services.repositories.approvals.listByWorkspace({
        workspaceId: outcome.workspaceId,
        status: "pending"
      });

      await services.approvalService.resolveApproval({
        approvalId: approval.id,
        resolution: "approved",
        resolutionNote: "Looks good."
      });

      await services.executionService.waitForRun(createdRun.id);

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
      await expect(services.repositories.runs.listSteps(createdRun.id)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Synthesize result",
            status: "completed"
          })
        ])
      );
      await expect(services.repositories.approvals.getById(approval.id)).resolves.toEqual(
        expect.objectContaining({
          id: approval.id,
          status: "resolved",
          resolution: "approved",
          resolutionNote: "Looks good."
        })
      );
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "approval.resolved",
            data: expect.objectContaining({
              id: approval.id,
              resolution: "approved"
            })
          })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("captures checkpoints only at durable execution boundaries", async () => {
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
      const createdRun = RunDetailSchema.parse(createRun.json());

      await services.executionService.waitForRun(createdRun.id);

      const blockedCheckpoints = await services.repositories.checkpoints.listByRun(
        createdRun.id
      );

      expect(blockedCheckpoints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "step_blocked_on_approval",
            resumable: false
          }),
          expect.objectContaining({
            kind: "run_started",
            resumable: true
          })
        ])
      );
      expect(
        blockedCheckpoints.every(
          (checkpoint) =>
            checkpoint.kind === "step_completed" ||
            checkpoint.kind === "step_blocked_on_approval" ||
            checkpoint.kind === "run_started"
        )
      ).toBe(true);

      const [approval] = await services.repositories.approvals.listByWorkspace({
        workspaceId: outcome.workspaceId,
        status: "pending"
      });
      await services.approvalService.resolveApproval({
        approvalId: approval.id,
        resolution: "approved",
        resolutionNote: "Resume."
      });
      await services.executionService.waitForRun(createdRun.id);

      await expect(
        services.repositories.checkpoints.listByRun(createdRun.id)
      ).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "approval_resolved"
          }),
          expect.objectContaining({
            kind: "run_completed",
            resumable: false
          })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("marks stranded active runs interrupted from their latest resumable checkpoint", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services, events } = harness;
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Recover a stranded run.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();
      const plan = await createNonReviewPlan(services.repositories, outcome.id);
      const run = await createRunForExistingPlan(services.repositories, {
        id: `run_${outcome.id}_recover`,
        outcomeId: outcome.id,
        planId: plan.id,
        createdAt: "2026-03-16T11:00:00.000Z",
        updatedAt: "2026-03-16T11:00:00.000Z"
      });
      const steps = await services.repositories.runs.listSteps(run.id);
      const rootStep = steps.find((step) => step.position === 0)!;
      const synthStep = steps.find((step) => step.position === 1)!;

      await services.repositories.workspaceLeases.acquire({
        runId: run.id,
        rootPath: `/tmp/${run.id}`,
        inputPath: `/tmp/${run.id}/input`,
        artifactsPath: `/tmp/${run.id}/artifacts`,
        logsPath: `/tmp/${run.id}/logs`,
        acquiredAt: "2026-03-16T11:00:01.000Z"
      });
      await services.repositories.runs.updateLifecycleStatus({
        runId: run.id,
        outcomeId: outcome.id,
        runStatus: "running",
        outcomeStatus: "running",
        updatedAt: "2026-03-16T11:00:02.000Z"
      });
      await services.repositories.runs.updateStepStatus({
        stepId: rootStep.id,
        status: "completed",
        updatedAt: "2026-03-16T11:00:03.000Z"
      });
      await services.repositories.runs.updateStepStatus({
        stepId: synthStep.id,
        status: "ready",
        updatedAt: "2026-03-16T11:00:03.000Z"
      });
      await services.checkpointService.createCheckpoint({
        runId: run.id,
        kind: "step_completed",
        stepId: rootStep.id
      });
      await services.repositories.workspaceLeases.release({
        runId: run.id,
        releasedAt: "2026-03-16T11:00:04.000Z"
      });

      await services.executionService.recoverInterruptedRuns();

      await expect(services.repositories.runs.getById(run.id)).resolves.toEqual(
        expect.objectContaining({
          id: run.id,
          status: "interrupted",
          resumable: true
        })
      );
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "run.interrupted",
            data: expect.objectContaining({
              run: expect.objectContaining({
                id: run.id,
                status: "interrupted"
              })
            })
          })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("keeps approval-blocked runs blocked during recovery scans", async () => {
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
      const createdRun = RunDetailSchema.parse(createRun.json());

      await services.executionService.waitForRun(createdRun.id);
      await services.executionService.recoverInterruptedRuns();

      await expect(services.repositories.runs.getById(createdRun.id)).resolves.toEqual(
        expect.objectContaining({
          id: createdRun.id,
          status: "blocked"
        })
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("rejects resume requests for approval-blocked runs", async () => {
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
      const createdRun = RunDetailSchema.parse(createRun.json());

      await services.executionService.waitForRun(createdRun.id);

      await expect(
        services.executionService.resumeRun({ runId: createdRun.id })
      ).rejects.toThrow(/blocked.*approval/i);
      await expect(
        services.repositories.approvals.listByWorkspace({
          workspaceId: outcome.workspaceId,
          status: "pending"
        })
      ).resolves.toHaveLength(1);
    } finally {
      await harness.cleanup();
    }
  });

  it("restores step state from the latest checkpoint and resumes only unfinished work", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services, fakeSandbox } = harness;
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Resume from a durable checkpoint.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();
      const plan = await createNonReviewPlan(services.repositories, outcome.id);
      const run = await createRunForExistingPlan(services.repositories, {
        id: `run_${outcome.id}_resume`,
        outcomeId: outcome.id,
        planId: plan.id,
        createdAt: "2026-03-16T12:00:00.000Z",
        updatedAt: "2026-03-16T12:00:00.000Z"
      });
      const steps = await services.repositories.runs.listSteps(run.id);
      const rootStep = steps.find((step) => step.position === 0)!;
      const synthStep = steps.find((step) => step.position === 1)!;

      await services.repositories.workspaceLeases.acquire({
        runId: run.id,
        rootPath: `/tmp/${run.id}`,
        inputPath: `/tmp/${run.id}/input`,
        artifactsPath: `/tmp/${run.id}/artifacts`,
        logsPath: `/tmp/${run.id}/logs`,
        acquiredAt: "2026-03-16T12:00:01.000Z"
      });
      await services.repositories.runs.updateLifecycleStatus({
        runId: run.id,
        outcomeId: outcome.id,
        runStatus: "running",
        outcomeStatus: "running",
        updatedAt: "2026-03-16T12:00:02.000Z"
      });
      await services.repositories.runs.updateStepStatus({
        stepId: rootStep.id,
        status: "completed",
        updatedAt: "2026-03-16T12:00:03.000Z"
      });
      await services.repositories.runs.updateStepStatus({
        stepId: synthStep.id,
        status: "ready",
        updatedAt: "2026-03-16T12:00:03.000Z"
      });
      await services.checkpointService.createCheckpoint({
        runId: run.id,
        kind: "step_completed",
        stepId: rootStep.id
      });
      await services.repositories.workspaceLeases.release({
        runId: run.id,
        releasedAt: "2026-03-16T12:00:04.000Z"
      });
      await services.repositories.runs.updateStepStatus({
        stepId: rootStep.id,
        status: "running",
        updatedAt: "2026-03-16T12:00:05.000Z"
      });
      await services.repositories.runs.updateStepStatus({
        stepId: synthStep.id,
        status: "pending",
        updatedAt: "2026-03-16T12:00:05.000Z"
      });
      await services.repositories.runs.updateStatus({
        runId: run.id,
        status: "interrupted",
        updatedAt: "2026-03-16T12:00:05.000Z"
      });

      await services.executionService.resumeRun({ runId: run.id });
      await services.executionService.waitForRun(run.id);

      expect(fakeSandbox.startedPlanNodeIds).not.toEqual(
        expect.arrayContaining([rootStep.planNodeId])
      );
      expect(fakeSandbox.startedPlanNodeIds).toEqual(
        expect.arrayContaining([synthStep.planNodeId])
      );
      await expect(services.repositories.runs.listSteps(run.id)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: rootStep.id,
            status: "completed"
          }),
          expect.objectContaining({
            id: synthStep.id,
            status: "completed"
          })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("rejects blocked review-required work and fails the run", async () => {
    const harness = await createExecutionHarness();

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

      await services.executionService.waitForRun(createdRun.id);

      const [approval] = await services.repositories.approvals.listByWorkspace({
        workspaceId: outcome.workspaceId,
        status: "pending"
      });

      await services.approvalService.resolveApproval({
        approvalId: approval.id,
        resolution: "rejected",
        resolutionNote: "Needs changes."
      });

      await services.executionService.waitForRun(createdRun.id);

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
      await expect(services.repositories.runs.listSteps(createdRun.id)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Synthesize result",
            status: "failed"
          })
        ])
      );
      await expect(services.repositories.approvals.getById(approval.id)).resolves.toEqual(
        expect.objectContaining({
          id: approval.id,
          status: "resolved",
          resolution: "rejected",
          resolutionNote: "Needs changes."
        })
      );
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcomeId: outcome.id,
            type: "approval.resolved",
            data: expect.objectContaining({
              id: approval.id,
              resolution: "rejected"
            })
          })
        ])
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("cancels the pending approval if the block lifecycle transition fails", async () => {
    const repositories = createInMemoryRepositories();
    const blockTransitionError = new Error("block lifecycle transition failed");
    const harness = await createExecutionHarness({
      repositories: {
        ...repositories,
        runs: {
        ...repositories.runs,
          async updateLifecycleStatus(
            input: Parameters<typeof repositories.runs.updateLifecycleStatus>[0]
          ) {
            if (
              input.runStatus === "blocked" &&
              input.outcomeStatus === "blocked_on_approval"
            ) {
              throw blockTransitionError;
            }

            return repositories.runs.updateLifecycleStatus(input);
          }
        }
      } as never
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

      await services.executionService.waitForRun(createdRun.id);

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
      await expect(
        services.repositories.approvals.listByWorkspace({
          workspaceId: outcome.workspaceId,
          status: "pending"
        })
      ).resolves.toEqual([]);
      await expect(
        services.repositories.approvals.listByWorkspace({
          workspaceId: outcome.workspaceId
        })
      ).resolves.toEqual([
        expect.objectContaining({
          status: "cancelled",
          resolution: "cancelled"
        })
      ]);
    } finally {
      await harness.cleanup();
    }
  });

  it("keeps the run blocked if approval resolution cannot release dependent steps", async () => {
    const repositories = createInMemoryRepositories();
    const releaseError = new Error("release ready dependents failed");
    const harness = await createExecutionHarness({
      repositories: {
        ...repositories,
        runs: {
        ...repositories.runs,
          async releaseReadyDependents(
            input: Parameters<typeof repositories.runs.releaseReadyDependents>[0]
          ) {
            throw releaseError;
          }
        }
      } as never
    });

    try {
      const { app, services } = harness;
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Pause after analysis before continuing.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();
      const plan = await createReviewBlockedParentPlan(services.repositories, outcome.id);

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });
      const createdRun = RunDetailSchema.parse(createRun.json());

      await services.executionService.waitForRun(createdRun.id);

      const [approval] = await services.repositories.approvals.listByWorkspace({
        workspaceId: outcome.workspaceId,
        status: "pending"
      });

      await expect(
        services.approvalService.resolveApproval({
          approvalId: approval.id,
          resolution: "approved",
          resolutionNote: "Proceed."
        })
      ).rejects.toThrow(releaseError.message);

      await expect(services.repositories.runs.getById(createdRun.id)).resolves.toEqual(
        expect.objectContaining({
          id: createdRun.id,
          status: "blocked"
        })
      );
      await expect(
        services.repositories.outcomes.getById(outcome.id)
      ).resolves.toEqual(
        expect.objectContaining({
          id: outcome.id,
          status: "blocked_on_approval"
        })
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("keeps non-review-required plans unchanged", async () => {
    const harness = await createExecutionHarness();

    try {
      const { app, services } = harness;
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Ship the launch brief and summary.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();
      const plan = await createNonReviewPlan(services.repositories, outcome.id);

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });
      const createdRun = RunDetailSchema.parse(createRun.json());

      await services.executionService.waitForRun(createdRun.id);

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
      await expect(
        services.repositories.approvals.listByWorkspace({
          workspaceId: outcome.workspaceId,
          status: "pending"
        })
      ).resolves.toEqual([]);
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
      const createOutcome = await app.inject({
        method: "POST",
        url: "/api/outcomes",
        payload: {
          workspaceId: "ws_123",
          userId: "user_123",
          prompt: "Ship the launch brief and summary.",
          source: "web"
        }
      });
      const outcome = createOutcome.json();
      const plan = await createNonReviewPlan(services.repositories, outcome.id);

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
