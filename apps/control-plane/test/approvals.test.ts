import { afterEach, describe, expect, it } from "vitest";
import {
  ApprovalListResponseSchema,
  ApprovalSchema,
  ArtifactLineageListResponseSchema
} from "@computer-oss/protocol";
import { createExecutionHarness, createOutcomeAndPlan } from "./execution-test-helpers";

const harnessesToCleanup = new Set<
  Awaited<ReturnType<typeof createExecutionHarness>>
>();

afterEach(async () => {
  await Promise.all(
    Array.from(harnessesToCleanup).map(async (harness) => {
      harnessesToCleanup.delete(harness);
      await harness.cleanup();
    })
  );
});

async function createBlockedApprovalRun() {
  const harness = await createExecutionHarness();
  harnessesToCleanup.add(harness);

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

  const run = createRun.json() as { id: string };
  await services.executionService.waitForRun(run.id);

  const [approval] = await services.repositories.approvals.listByWorkspace({
    workspaceId: outcome.workspaceId,
    status: "pending"
  });

  if (!approval) {
    throw new Error("Expected a pending approval after the blocked run.");
  }

  return {
    harness,
    app,
    services,
    outcome,
    run,
    approval
  };
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  match: (chunkText: string) => boolean
) {
  for (let attempts = 0; attempts < 12; attempts += 1) {
    const chunk = await reader.read();
    const chunkText = new TextDecoder().decode(chunk.value);

    if (match(chunkText)) {
      return chunkText;
    }
  }

  throw new Error("Timed out waiting for expected SSE event.");
}

describe("approval routes", () => {
  it("lists pending approvals by workspace and returns approval detail", async () => {
    const { app, outcome, approval } = await createBlockedApprovalRun();

    const list = await app.inject({
      method: "GET",
      url: `/api/approvals?workspaceId=${outcome.workspaceId}`
    });

    expect(list.statusCode).toBe(200);
    expect(ApprovalListResponseSchema.parse(list.json())).toEqual({
      approvals: [expect.objectContaining({ id: approval.id, status: "pending" })]
    });

    const detail = await app.inject({
      method: "GET",
      url: `/api/approvals/${approval.id}`
    });

    expect(detail.statusCode).toBe(200);
    expect(ApprovalSchema.parse(detail.json())).toEqual(
      expect.objectContaining({
        id: approval.id,
        outcomeId: outcome.id,
        runId: approval.runId,
        stepId: approval.stepId,
        status: "pending"
      })
    );
  });

  it("approves a pending approval", async () => {
    const { app, approval } = await createBlockedApprovalRun();

    const response = await app.inject({
      method: "POST",
      url: `/api/approvals/${approval.id}/approve`,
      payload: {
        resolutionNote: "Looks good."
      }
    });

    expect(response.statusCode).toBe(200);
    expect(ApprovalSchema.parse(response.json())).toEqual(
      expect.objectContaining({
        id: approval.id,
        status: "resolved",
        resolution: "approved",
        resolutionNote: "Looks good."
      })
    );
  });

  it("rejects a pending approval", async () => {
    const { app, approval } = await createBlockedApprovalRun();

    const response = await app.inject({
      method: "POST",
      url: `/api/approvals/${approval.id}/reject`,
      payload: {
        resolutionNote: "Needs changes."
      }
    });

    expect(response.statusCode).toBe(200);
    expect(ApprovalSchema.parse(response.json())).toEqual(
      expect.objectContaining({
        id: approval.id,
        status: "resolved",
        resolution: "rejected",
        resolutionNote: "Needs changes."
      })
    );
  });

  it("lists artifact-lineage edges for a run", async () => {
    const { app, approval } = await createBlockedApprovalRun();

    const response = await app.inject({
      method: "GET",
      url: `/api/runs/${approval.runId}/artifact-lineage`
    });

    expect(response.statusCode).toBe(200);
    expect(ArtifactLineageListResponseSchema.parse(response.json())).toEqual({
      edges: expect.arrayContaining([
        expect.objectContaining({
          runId: approval.runId,
          childStepId: approval.stepId,
          relation: "derived_from"
        })
      ])
    });
  });

  it("streams approval request and resolution events over the outcome stream", async () => {
    const harness = await createExecutionHarness();
    harnessesToCleanup.add(harness);

    const { app } = harness;
    const { outcome, plan } = await createOutcomeAndPlan(app);

    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();

    if (!address || typeof address === "string") {
      throw new Error("Expected an address object from Fastify.");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const streamResponse = await fetch(`${baseUrl}/api/outcomes/${outcome.id}/events`);
    const reader = streamResponse.body?.getReader();

    if (!reader) {
      throw new Error("Expected a response body for SSE route.");
    }

    try {
      await reader.read();

      const createRun = await app.inject({
        method: "POST",
        url: `/api/outcomes/${outcome.id}/runs`,
        payload: {
          planId: plan.id
        }
      });

      expect(createRun.statusCode).toBe(201);
      const run = createRun.json() as { id: string };
      await harness.services.executionService.waitForRun(run.id);

      const requestedChunk = await readUntil(reader, (chunkText) =>
        chunkText.includes("event: approval.requested")
      );

      expect(requestedChunk).toContain("event: approval.requested");

      const [approval] = await harness.services.repositories.approvals.listByWorkspace({
        workspaceId: outcome.workspaceId,
        status: "pending"
      });

      if (!approval) {
        throw new Error("Expected a pending approval after the blocked run.");
      }

      const resolve = await fetch(`${baseUrl}/api/approvals/${approval.id}/approve`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          resolutionNote: "Approved from SSE test."
        })
      });

      expect(resolve.status).toBe(200);

      const resolvedChunk = await readUntil(reader, (chunkText) =>
        chunkText.includes("event: approval.resolved")
      );

      expect(resolvedChunk).toContain("event: approval.resolved");
      expect(resolvedChunk).toContain("Approved from SSE test.");
    } finally {
      await reader.cancel();
    }
  });
});
