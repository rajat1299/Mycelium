import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { SandboxProvider } from "@computer-oss/sandbox";
import {
  LocalDockerProvider,
  WorkspaceManager
} from "@computer-oss/sandbox";
import type { AppEnv } from "./env";
import {
  createEncryptionService,
  type EncryptionService
} from "./encryption";
import { createEventBus, type EventBus } from "./event-bus";
import {
  createExecutionService,
  type ExecutionService
} from "./execution-service";
import {
  createDatabaseRepositories,
  createInMemoryRepositories,
  type Repositories
} from "./repositories";

export type ServiceContainer = {
  repositories: Repositories;
  eventBus: EventBus;
  executionService: ExecutionService;
  encryption: EncryptionService;
};

type InMemoryServiceContainerOptions = {
  repositories?: Repositories;
  eventBus?: EventBus;
  sandboxProvider?: SandboxProvider;
  workspaceRootPath?: string;
  encryptionKey?: string;
  now?: () => Date;
};

export function createInMemoryServiceContainer(
  options: InMemoryServiceContainerOptions = {}
): ServiceContainer {
  const repositories = options.repositories ?? createInMemoryRepositories();
  const eventBus = options.eventBus ?? createEventBus();
  const encryption = createEncryptionService(options.encryptionKey);
  const workspaceManager = new WorkspaceManager({
    rootPath:
      options.workspaceRootPath ??
      join(tmpdir(), "mycelium-control-plane-workspaces"),
    ...(options.now ? { now: options.now } : {})
  });
  const sandboxProvider = options.sandboxProvider ?? createInlineSandboxProvider();
  const executionService = createExecutionService({
    repositories,
    eventBus,
    sandboxProvider,
    workspaceManager,
    ...(options.now ? { now: options.now } : {})
  });

  return {
    repositories,
    eventBus,
    executionService,
    encryption
  };
}

export async function createServiceContainer(env: AppEnv): Promise<ServiceContainer> {
  const repositories = await createDatabaseRepositories(env.DATABASE_URL);
  const eventBus = createEventBus();
  const encryption = createEncryptionService(env.MYCELIUM_ENCRYPTION_KEY);
  const workspaceManager = new WorkspaceManager({
    rootPath: env.WORKSPACE_ROOT
  });
  const sandboxProvider = new LocalDockerProvider(
    env.SANDBOX_IMAGE ? { image: env.SANDBOX_IMAGE } : {}
  );
  const executionService = createExecutionService({
    repositories,
    eventBus,
    sandboxProvider,
    workspaceManager
  });

  return {
    repositories,
    eventBus,
    executionService,
    encryption
  };
}

function createInlineSandboxProvider(): SandboxProvider {
  return {
    async execute(request) {
      const startedAt = new Date().toISOString();
      const producedArtifactPaths = request.step.expectedArtifactPath
        ? [request.step.expectedArtifactPath]
        : [];

      for (const relativePath of producedArtifactPaths) {
        const absolutePath = resolve(request.workspace.rootPath, relativePath);
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(
          absolutePath,
          `artifact for ${request.step.planNodeId}\n`
        );
      }

      return {
        containerName: `inline-${request.step.id}`,
        exitCode: 0,
        stdout: `completed ${request.step.planNodeId}\n`,
        stderr: "",
        startedAt,
        finishedAt: startedAt,
        durationMs: 0,
        producedArtifactPaths
      };
    }
  };
}
