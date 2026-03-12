import { access, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceManager } from "./workspace-manager";

describe("WorkspaceManager", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
    roots.length = 0;
  });

  it("allocates deterministic workspace paths per run", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "mycelium-workspaces-"));
    roots.push(rootPath);

    const manager = new WorkspaceManager({ rootPath });

    const first = manager.getPaths("run_123");
    const second = manager.getPaths("run_123");

    expect(second).toEqual(first);
    expect(first.rootPath).not.toBe(rootPath);
    expect(first.inputPath.startsWith(first.rootPath)).toBe(true);
    expect(first.artifactsPath.startsWith(first.rootPath)).toBe(true);
    expect(first.logsPath.startsWith(first.rootPath)).toBe(true);
  });

  it("prevents double acquisition of the same workspace until it is released", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "mycelium-workspaces-"));
    roots.push(rootPath);

    const manager = new WorkspaceManager({ rootPath });

    const firstLease = await manager.acquire("run_123");

    await expect(manager.acquire("run_123")).rejects.toThrow(
      "Workspace already leased for run run_123"
    );

    await access(firstLease.paths.inputPath);
    await access(firstLease.paths.artifactsPath);
    await access(firstLease.paths.logsPath);

    manager.release("run_123");

    const secondLease = await manager.acquire("run_123");
    expect(secondLease.paths).toEqual(firstLease.paths);
  });
});
