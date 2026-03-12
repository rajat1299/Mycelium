import { randomUUID } from "node:crypto";
import { mkdir, readdir } from "node:fs/promises";
import { posix, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import type {
  DockerRunRequest,
  DockerRunResult,
  DockerRunner,
  SandboxExecutionRequest,
  SandboxExecutionResult,
  SandboxProvider
} from "./provider";

const DEFAULT_IMAGE = "node:22-bookworm-slim";
const DEFAULT_TIMEOUT_MS = 60_000;

export interface LocalDockerProviderOptions {
  image?: string;
  runner?: DockerRunner;
  randomSuffix?: () => string;
}

export class LocalDockerProvider implements SandboxProvider {
  private readonly image: string;
  private readonly runner: DockerRunner;
  private readonly randomSuffix: () => string;

  constructor(options: LocalDockerProviderOptions = {}) {
    this.image = options.image ?? DEFAULT_IMAGE;
    this.runner = options.runner ?? createDockerCliRunner();
    this.randomSuffix = options.randomSuffix ?? (() => randomUUID().slice(0, 8));
  }

  async execute(request: SandboxExecutionRequest): Promise<SandboxExecutionResult> {
    if (request.step.runId !== request.runId) {
      throw new Error("Sandbox step runId must match the requested runId");
    }

    await Promise.all([
      mkdir(request.workspace.inputPath, { recursive: true }),
      mkdir(request.workspace.artifactsPath, { recursive: true }),
      mkdir(request.workspace.logsPath, { recursive: true })
    ]);

    const containerName = createContainerName(
      request.runId,
      request.step.id,
      this.randomSuffix()
    );

    const dockerRequest: DockerRunRequest = {
      image: this.image,
      name: containerName,
      remove: true,
      workdir: "/workspace",
      mounts: [
        {
          source: request.workspace.inputPath,
          target: "/workspace/input",
          readOnly: false
        },
        {
          source: request.workspace.artifactsPath,
          target: "/workspace/artifacts",
          readOnly: false
        },
        {
          source: request.workspace.logsPath,
          target: "/workspace/logs",
          readOnly: false
        }
      ],
      environment: buildEnvironment(request),
      command: ["node", "-e", buildExecutionScript()],
      timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS
    };

    const runResult = await this.runner.run(dockerRequest);
    const producedArtifactPaths = await listArtifactPaths(request.workspace.artifactsPath);

    return {
      containerName,
      exitCode: runResult.exitCode,
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      startedAt: runResult.startedAt,
      finishedAt: runResult.finishedAt,
      durationMs: runResult.durationMs,
      producedArtifactPaths
    };
  }
}

export function createDockerCliRunner(): DockerRunner {
  return {
    async run(request: DockerRunRequest): Promise<DockerRunResult> {
      const args = buildDockerArgs(request);
      const startedAtMs = Date.now();
      const startedAt = new Date(startedAtMs).toISOString();

      return await new Promise<DockerRunResult>((resolvePromise, rejectPromise) => {
        const child = spawn("docker", args, {
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";
        let timedOut = false;

        const timer =
          request.timeoutMs === undefined
            ? undefined
            : setTimeout(() => {
                timedOut = true;
                child.kill("SIGKILL");
              }, request.timeoutMs);

        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });

        child.on("error", (error) => {
          if (timer) {
            clearTimeout(timer);
          }

          rejectPromise(error);
        });

        child.on("close", async (code) => {
          if (timer) {
            clearTimeout(timer);
          }

          if (timedOut) {
            await forceRemoveContainer(request.name);
          }

          const finishedAtMs = Date.now();
          const finishedAt = new Date(finishedAtMs).toISOString();

          resolvePromise({
            exitCode: timedOut ? 124 : (code ?? 1),
            stdout,
            stderr:
              timedOut && stderr.length === 0
                ? `Sandbox execution timed out after ${request.timeoutMs}ms`
                : stderr,
            startedAt,
            finishedAt,
            durationMs: finishedAtMs - startedAtMs
          });
        });
      });
    }
  };
}

async function forceRemoveContainer(name: string): Promise<void> {
  await new Promise<void>((resolvePromise) => {
    const child = spawn("docker", ["rm", "-f", name], {
      stdio: "ignore"
    });

    child.on("error", () => {
      resolvePromise();
    });

    child.on("close", () => {
      resolvePromise();
    });
  });
}

function buildDockerArgs(request: DockerRunRequest): string[] {
  const args = ["run"];

  if (request.remove) {
    args.push("--rm");
  }

  args.push("--name", request.name);
  args.push("--workdir", request.workdir);

  for (const mount of request.mounts) {
    args.push(
      "--volume",
      `${resolve(mount.source)}:${mount.target}${mount.readOnly ? ":ro" : ""}`
    );
  }

  for (const [key, value] of Object.entries(request.environment)) {
    args.push("--env", `${key}=${value}`);
  }

  args.push(request.image, ...request.command);

  return args;
}

function buildEnvironment(request: SandboxExecutionRequest): Record<string, string> {
  const environment: Record<string, string> = {
    MYCELIUM_OUTCOME_ID: request.context.outcomeId,
    MYCELIUM_OUTCOME_PROMPT: request.context.outcomePrompt,
    MYCELIUM_RUN_ID: request.runId,
    MYCELIUM_STEP_ID: request.step.id,
    MYCELIUM_STEP_TITLE: request.step.title
  };

  if (request.step.instruction) {
    environment.MYCELIUM_STEP_INSTRUCTION = request.step.instruction;
  }

  if (request.step.template) {
    environment.MYCELIUM_STEP_TEMPLATE = request.step.template;
  }

  if (request.step.expectedArtifactKind) {
    environment.MYCELIUM_EXPECTED_ARTIFACT_KIND = request.step.expectedArtifactKind;
  }

  const artifactPath = normalizeWorkspaceRelativePath(request.step.expectedArtifactPath);
  if (artifactPath) {
    environment.MYCELIUM_EXPECTED_ARTIFACT_PATH = artifactPath;
  }

  return {
    ...environment,
    ...request.environment
  };
}

function buildExecutionScript(): string {
  return [
    "const fs = require('node:fs/promises');",
    "const path = require('node:path');",
    "async function main() {",
    "  const artifactPath = process.env.MYCELIUM_EXPECTED_ARTIFACT_PATH;",
    "  const title = process.env.MYCELIUM_STEP_TITLE ?? 'Untitled step';",
    "  const template = process.env.MYCELIUM_STEP_TEMPLATE ?? 'unknown';",
    "  const instruction = process.env.MYCELIUM_STEP_INSTRUCTION ?? '';",
    "  const prompt = process.env.MYCELIUM_OUTCOME_PROMPT ?? '';",
    "  const stepId = process.env.MYCELIUM_STEP_ID ?? 'unknown-step';",
    "  if (artifactPath) {",
    "    const fullArtifactPath = path.join('/workspace', artifactPath);",
    "    await fs.mkdir(path.dirname(fullArtifactPath), { recursive: true });",
    "    await fs.writeFile(fullArtifactPath, [`# ${title}`, '', `Template: ${template}`, '', instruction, '', `Outcome prompt: ${prompt}`].join('\\n'));",
    "  }",
    "  await fs.mkdir('/workspace/logs', { recursive: true });",
    "  await fs.writeFile('/workspace/logs/step.log', `completed ${stepId}\\n`, { flag: 'a' });",
    "  console.log(`completed ${stepId}`);",
    "}",
    "main().catch((error) => {",
    "  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));",
    "  process.exit(1);",
    "});"
  ].join("");
}

async function listArtifactPaths(artifactsPath: string): Promise<string[]> {
  const paths = await listRelativeFiles(artifactsPath, artifactsPath);
  return paths
    .map((relativePath) => `artifacts/${relativePath.replace(/\\/g, "/")}`)
    .sort((left, right) => left.localeCompare(right));
}

async function listRelativeFiles(rootPath: string, currentPath: string): Promise<string[]> {
  const entries = await readdir(currentPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = resolve(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(rootPath, entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(relative(rootPath, entryPath));
    }
  }

  return files;
}

function normalizeWorkspaceRelativePath(relativePath: string | undefined): string | undefined {
  if (!relativePath) {
    return undefined;
  }

  if (relativePath.startsWith("/")) {
    throw new Error("Expected artifact path must be relative to the workspace");
  }

  const normalized = posix.normalize(relativePath.replace(/\\/g, "/"));
  if (
    normalized.length === 0 ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    throw new Error("Expected artifact path must stay within the workspace");
  }

  return normalized;
}

function createContainerName(runId: string, stepId: string, suffix: string): string {
  return `mycelium-${sanitizeSegment(runId)}-${sanitizeSegment(stepId)}-${sanitizeSegment(suffix)}`;
}

function sanitizeSegment(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized.length > 0 ? sanitized : "step";
}
