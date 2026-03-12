import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { LocalArtifactStore } from "./store";

describe("LocalArtifactStore", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
    roots.length = 0;
  });

  it("writes, reads, and lists artifacts only under the configured root", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "mycelium-artifacts-"));
    roots.push(rootPath);

    const store = new LocalArtifactStore({ rootPath });

    const stored = await store.put({
      relativePath: "runs/run_123/brief.md",
      body: "# Draft brief\n"
    });

    expect(stored).toEqual(
      expect.objectContaining({
        relativePath: "runs/run_123/brief.md",
        size: "# Draft brief\n".length
      })
    );

    await expect(store.read("runs/run_123/brief.md")).resolves.toEqual(
      Buffer.from("# Draft brief\n")
    );

    await expect(store.list("runs/run_123")).resolves.toEqual([
      expect.objectContaining({
        relativePath: "runs/run_123/brief.md"
      })
    ]);
  });

  it("rejects path traversal outside the configured root", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "mycelium-artifacts-"));
    roots.push(rootPath);

    const store = new LocalArtifactStore({ rootPath });

    await expect(
      store.put({
        relativePath: "../escape.md",
        body: "nope"
      })
    ).rejects.toThrow("Artifact path must stay within the configured root");

    await expect(store.read("../../etc/passwd")).rejects.toThrow(
      "Artifact path must stay within the configured root"
    );
  });

  it("canonicalizes equivalent relative paths to a single artifact identity", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "mycelium-artifacts-"));
    roots.push(rootPath);

    const store = new LocalArtifactStore({ rootPath });

    const stored = await store.put({
      relativePath: "runs/run_123/../brief.md",
      body: "# Draft brief\n"
    });

    expect(stored.relativePath).toBe("runs/brief.md");
    await expect(store.read("runs/brief.md")).resolves.toEqual(Buffer.from("# Draft brief\n"));
    await expect(store.list("runs")).resolves.toEqual([
      expect.objectContaining({
        relativePath: "runs/brief.md"
      })
    ]);
  });
});
