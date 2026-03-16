import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import {
  CheckpointDetailPayloadSchema,
  type CheckpointDetailPayload
} from "@computer-oss/protocol";
import type {
  CheckpointStore,
  CheckpointStoreReadResult,
  CheckpointStoreWriteInput,
  CheckpointStoreWriteResult
} from "./types";

const STORED_CHECKPOINT_MANIFEST_VERSION = 1 as const;

type StoredCheckpointManifest = {
  version: typeof STORED_CHECKPOINT_MANIFEST_VERSION;
  checkpointId: string;
  runId: string;
  sequence: number;
  payload: CheckpointDetailPayload;
};

function buildStoreKey(runId: string, sequence: number, checkpointId: string) {
  return `${runId}/${String(sequence).padStart(6, "0")}-${checkpointId}.json`;
}

function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeStoreKey(storeKey: string) {
  const normalized = normalize(storeKey).replace(/\\/g, "/");

  if (
    normalized === "" ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.startsWith("/")
  ) {
    throw new Error("Checkpoint store key cannot escape the checkpoint root via path traversal.");
  }

  return normalized;
}

function resolveStorePath(rootDir: string, storeKey: string) {
  const normalizedStoreKey = normalizeStoreKey(storeKey);
  const resolvedRoot = resolve(rootDir);
  const resolvedPath = resolve(resolvedRoot, normalizedStoreKey);

  if (
    resolvedPath !== resolvedRoot &&
    !resolvedPath.startsWith(`${resolvedRoot}${sep}`)
  ) {
    throw new Error("Checkpoint store key cannot escape the checkpoint root via path traversal.");
  }

  return {
    normalizedStoreKey,
    resolvedPath
  };
}

export class LocalFilesystemCheckpointStore implements CheckpointStore {
  constructor(private readonly options: { rootDir: string }) {}

  async writeCheckpoint(
    input: CheckpointStoreWriteInput
  ): Promise<CheckpointStoreWriteResult> {
    const manifest = CheckpointDetailPayloadSchema.parse(input.manifest);
    const storeKey = buildStoreKey(input.runId, input.sequence, input.checkpointId);
    const { normalizedStoreKey, resolvedPath } = resolveStorePath(
      this.options.rootDir,
      storeKey
    );
    const persisted: StoredCheckpointManifest = {
      version: STORED_CHECKPOINT_MANIFEST_VERSION,
      checkpointId: input.checkpointId,
      runId: input.runId,
      sequence: input.sequence,
      payload: manifest
    };
    const buffer = Buffer.from(JSON.stringify(persisted, null, 2));

    await mkdir(dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, buffer);

    return {
      storeKey: normalizedStoreKey,
      checksum: hashBuffer(buffer),
      byteSize: buffer.byteLength
    };
  }

  async readCheckpoint(storeKey: string): Promise<CheckpointStoreReadResult> {
    const { normalizedStoreKey, resolvedPath } = resolveStorePath(
      this.options.rootDir,
      storeKey
    );
    const buffer = await readFile(resolvedPath);
    const persisted = JSON.parse(buffer.toString()) as StoredCheckpointManifest;

    if (persisted.version !== STORED_CHECKPOINT_MANIFEST_VERSION) {
      throw new Error(`Unsupported checkpoint manifest version: ${persisted.version}`);
    }

    return {
      storeKey: normalizedStoreKey,
      checksum: hashBuffer(buffer),
      byteSize: buffer.byteLength,
      manifest: CheckpointDetailPayloadSchema.parse(persisted.payload)
    };
  }

  async deleteCheckpoint(storeKey: string): Promise<void> {
    const { resolvedPath } = resolveStorePath(this.options.rootDir, storeKey);
    await rm(resolvedPath, { force: true });
  }
}
