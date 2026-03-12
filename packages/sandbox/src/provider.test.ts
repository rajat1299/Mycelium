import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalDockerProvider } from "./local-docker-provider";
import { WorkspaceManager } from "./workspace-manager";

describe("LocalDockerProvider", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
    roots.length = 0;
  });

  it("translates a step execution request into an isolated docker run", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "mycelium-sandbox-provider-"));
    roots.push(rootPath);

    const manager = new WorkspaceManager({ rootPath });
    const lease = await manager.acquire("run_123");

    const runner = {
      run: vi.fn(async (request: { mounts: Array<{ source: string; target: string }> }) => {
        const artifactMount = request.mounts.find(
          (mount) => mount.target === "/workspace/artifacts"
        );

        if (!artifactMount) {
          throw new Error("expected artifacts mount");
        }

        await mkdir(artifactMount.source, { recursive: true });
        await writeFile(join(artifactMount.source, "brief.md"), "# Draft brief\n");

        return {
          exitCode: 0,
          stdout: "step complete",
          stderr: "",
          startedAt: "2026-03-12T10:00:00.000Z",
          finishedAt: "2026-03-12T10:00:01.000Z",
          durationMs: 1000
        };
      })
    };

    const provider = new LocalDockerProvider({
      image: "node:22-bookworm-slim",
      runner,
      randomSuffix: () => "seed123"
    });

    const result = await provider.execute({
      runId: "run_123",
      context: {
        outcomeId: "outcome_123",
        outcomePrompt: "Draft the operator brief."
      },
      step: {
        id: "step_123",
        planNodeId: "plan_outcome_123:draft-brief",
        title: "Draft brief",
        kind: "task",
        capability: "coding",
        instruction: "Write the brief artifact.",
        template: "draft_brief",
        expectedArtifactPath: "artifacts/brief.md",
        expectedArtifactKind: "brief",
        status: "ready",
        position: 1,
        createdAt: "2026-03-12T10:00:00.000Z",
        updatedAt: "2026-03-12T10:00:00.000Z",
        runId: "run_123"
      },
      workspace: lease.paths,
      environment: {
        TEST_MODE: "1"
      },
      timeoutMs: 30_000
    });

    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "node:22-bookworm-slim",
        name: "mycelium-run-123-step-123-seed123",
        remove: true,
        workdir: "/workspace",
        timeoutMs: 30_000,
        mounts: [
          {
            source: lease.paths.inputPath,
            target: "/workspace/input",
            readOnly: false
          },
          {
            source: lease.paths.artifactsPath,
            target: "/workspace/artifacts",
            readOnly: false
          },
          {
            source: lease.paths.logsPath,
            target: "/workspace/logs",
            readOnly: false
          }
        ],
        environment: expect.objectContaining({
          MYCELIUM_OUTCOME_ID: "outcome_123",
          MYCELIUM_OUTCOME_PROMPT: "Draft the operator brief.",
          MYCELIUM_RUN_ID: "run_123",
          MYCELIUM_STEP_ID: "step_123",
          MYCELIUM_STEP_TITLE: "Draft brief",
          MYCELIUM_STEP_TEMPLATE: "draft_brief",
          MYCELIUM_EXPECTED_ARTIFACT_PATH: "artifacts/brief.md",
          TEST_MODE: "1"
        }),
        command: expect.arrayContaining(["node", "-e"])
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        containerName: "mycelium-run-123-step-123-seed123",
        exitCode: 0,
        stdout: "step complete",
        stderr: "",
        producedArtifactPaths: ["artifacts/brief.md"]
      })
    );
  });

  it("rejects artifact paths that escape the mounted workspace", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "mycelium-sandbox-provider-"));
    roots.push(rootPath);

    const manager = new WorkspaceManager({ rootPath });
    const lease = await manager.acquire("run_123");
    const runner = {
      run: vi.fn()
    };

    const provider = new LocalDockerProvider({ runner });

    await expect(
      provider.execute({
        runId: "run_123",
        context: {
          outcomeId: "outcome_123",
          outcomePrompt: "Draft the operator brief."
        },
        step: {
          id: "step_123",
          planNodeId: "plan_outcome_123:draft-brief",
          title: "Draft brief",
          kind: "task",
          capability: "coding",
          instruction: "Write the brief artifact.",
          template: "draft_brief",
          expectedArtifactPath: "artifacts/../../escape.md",
          expectedArtifactKind: "brief",
          status: "ready",
          position: 1,
          createdAt: "2026-03-12T10:00:00.000Z",
          updatedAt: "2026-03-12T10:00:00.000Z",
          runId: "run_123"
        },
        workspace: lease.paths
      })
    ).rejects.toThrow("Expected artifact path must stay within the workspace");

    expect(runner.run).not.toHaveBeenCalled();
  });

  it("rejects steps that do not belong to the requested run", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "mycelium-sandbox-provider-"));
    roots.push(rootPath);

    const manager = new WorkspaceManager({ rootPath });
    const lease = await manager.acquire("run_123");
    const runner = {
      run: vi.fn()
    };

    const provider = new LocalDockerProvider({ runner });

    await expect(
      provider.execute({
        runId: "run_123",
        context: {
          outcomeId: "outcome_123",
          outcomePrompt: "Draft the operator brief."
        },
        step: {
          id: "step_123",
          planNodeId: "plan_outcome_123:draft-brief",
          title: "Draft brief",
          kind: "task",
          capability: "coding",
          instruction: "Write the brief artifact.",
          template: "draft_brief",
          expectedArtifactPath: "artifacts/brief.md",
          expectedArtifactKind: "brief",
          status: "ready",
          position: 1,
          createdAt: "2026-03-12T10:00:00.000Z",
          updatedAt: "2026-03-12T10:00:00.000Z",
          runId: "run_other"
        },
        workspace: lease.paths
      })
    ).rejects.toThrow("Sandbox step runId must match the requested runId");

    expect(runner.run).not.toHaveBeenCalled();
  });
});
