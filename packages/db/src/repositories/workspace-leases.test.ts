import { describe, expect, it } from "vitest";
import { WorkspaceLeaseRepository } from "./workspace-leases";
import { createRepositoryTestDatabase } from "./test-database";

describe("WorkspaceLeaseRepository", () => {
  it("acquires and reads an active workspace lease for a run", async () => {
    const { db, state } = createRepositoryTestDatabase();
    state.outcomeRuns.push({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      status: "queued",
      createdAt: new Date("2026-03-12T00:05:00.000Z"),
      updatedAt: new Date("2026-03-12T00:05:00.000Z")
    });

    const repository = new WorkspaceLeaseRepository(db as never);

    const lease = await repository.acquire({
      runId: "run_123",
      rootPath: "/tmp/mycelium/run_123",
      inputPath: "/tmp/mycelium/run_123/input",
      artifactsPath: "/tmp/mycelium/run_123/artifacts",
      logsPath: "/tmp/mycelium/run_123/logs",
      acquiredAt: "2026-03-12T00:05:10.000Z"
    });

    expect(lease).toEqual(
      expect.objectContaining({
        runId: "run_123",
        rootPath: "/tmp/mycelium/run_123",
        releasedAt: null
      })
    );

    await expect(repository.getActiveByRun("run_123")).resolves.toEqual(
      expect.objectContaining({
        runId: "run_123",
        artifactsPath: "/tmp/mycelium/run_123/artifacts"
      })
    );
  });

  it("releases an active workspace lease and rejects duplicate active leases", async () => {
    const { db, state } = createRepositoryTestDatabase();
    state.outcomeRuns.push({
      id: "run_123",
      outcomeId: "outcome_123",
      planId: "plan_outcome_123",
      status: "queued",
      createdAt: new Date("2026-03-12T00:05:00.000Z"),
      updatedAt: new Date("2026-03-12T00:05:00.000Z")
    });

    const repository = new WorkspaceLeaseRepository(db as never);

    await repository.acquire({
      runId: "run_123",
      rootPath: "/tmp/mycelium/run_123",
      inputPath: "/tmp/mycelium/run_123/input",
      artifactsPath: "/tmp/mycelium/run_123/artifacts",
      logsPath: "/tmp/mycelium/run_123/logs",
      acquiredAt: "2026-03-12T00:05:10.000Z"
    });

    await expect(
      repository.acquire({
        runId: "run_123",
        rootPath: "/tmp/mycelium/run_123",
        inputPath: "/tmp/mycelium/run_123/input",
        artifactsPath: "/tmp/mycelium/run_123/artifacts",
        logsPath: "/tmp/mycelium/run_123/logs",
        acquiredAt: "2026-03-12T00:05:11.000Z"
      })
    ).rejects.toThrow("Active workspace lease already exists for run run_123.");

    const released = await repository.release({
      runId: "run_123",
      releasedAt: "2026-03-12T00:09:00.000Z"
    });

    expect(released).toEqual(
      expect.objectContaining({
        runId: "run_123",
        releasedAt: "2026-03-12T00:09:00.000Z"
      })
    );

    await expect(repository.getActiveByRun("run_123")).resolves.toBeNull();
  });
});
