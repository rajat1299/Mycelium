import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CheckpointDetailPayloadSchema } from "@computer-oss/protocol";
import { LocalFilesystemCheckpointStore } from "./local-filesystem-store";

describe("LocalFilesystemCheckpointStore", () => {
  it("writes and reads a versioned checkpoint manifest", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "mycelium-checkpoints-"));
    const store = new LocalFilesystemCheckpointStore({ rootDir });

    const manifest = CheckpointDetailPayloadSchema.parse({
      version: 1,
      run: {
        id: "run_123",
        outcomeId: "outcome_123",
        workspaceId: "ws_default",
        status: "running"
      },
      steps: [],
      readyStepIds: [],
      blockedStepIds: [],
      workspacePaths: {
        inputDir: "input",
        logsDir: "logs",
        artifactsDir: "artifacts"
      },
      artifactIds: [],
      latestAuditSequence: 0
    });

    const written = await store.writeCheckpoint({
      runId: "run_123",
      checkpointId: "checkpoint_123",
      sequence: 7,
      manifest
    });

    expect(written.storeKey).toBe("run_123/000007-checkpoint_123.json");
    expect(written.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(written.byteSize).toBeGreaterThan(0);

    const read = await store.readCheckpoint(written.storeKey);

    expect(read.storeKey).toBe(written.storeKey);
    expect(read.checksum).toBe(written.checksum);
    expect(read.byteSize).toBe(written.byteSize);
    expect(read.manifest).toEqual(manifest);

    await rm(rootDir, { recursive: true, force: true });
  });

  it("rejects path traversal when reading a checkpoint", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "mycelium-checkpoints-"));
    const store = new LocalFilesystemCheckpointStore({ rootDir });

    await expect(store.readCheckpoint("../escape.json")).rejects.toThrow(
      /path traversal/i
    );

    await rm(rootDir, { recursive: true, force: true });
  });
});
