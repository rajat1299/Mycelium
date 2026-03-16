import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { LocalFilesystemCheckpointStore } from "@computer-oss/checkpoints";
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
  createApprovalService,
  type ApprovalService
} from "./approval-service";
import {
  createCheckpointService,
  type CheckpointService
} from "./checkpoint-service";
import {
  createExecutionService,
  type ExecutionService
} from "./execution-service";
import {
  createRouterService,
  type RouterService
} from "./router-service";
import {
  createDatabaseRepositories,
  createInMemoryRepositories,
  type Repositories
} from "./repositories";

export type ServiceContainer = {
  repositories: Repositories;
  eventBus: EventBus;
  executionService: ExecutionService;
  approvalService: ApprovalService;
  checkpointService: CheckpointService;
  encryption: EncryptionService;
  routerService: RouterService;
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
  const routerService = createRouterService({
    repositories,
    ...(options.now ? { now: options.now } : {})
  });
  const workspaceManager = new WorkspaceManager({
    rootPath:
      options.workspaceRootPath ??
      join(tmpdir(), "mycelium-control-plane-workspaces"),
    ...(options.now ? { now: options.now } : {})
  });
  const sandboxProvider = options.sandboxProvider ?? createInlineSandboxProvider();
  const checkpointService = createCheckpointService({
    repositories,
    eventBus,
    checkpointStore: new LocalFilesystemCheckpointStore({
      rootDir: join(
        options.workspaceRootPath ??
          join(tmpdir(), "mycelium-control-plane-workspaces"),
        ".checkpoints"
      )
    }),
    ...(options.now ? { now: options.now } : {})
  });
  const executionService = createExecutionService({
    repositories,
    eventBus,
    checkpointService,
    sandboxProvider,
    workspaceManager,
    ...(options.now ? { now: options.now } : {})
  });
  const approvalService = createApprovalService({
    repositories,
    eventBus,
    checkpointService,
    executionService,
    ...(options.now ? { now: options.now } : {})
  });

  return {
    repositories,
    eventBus,
    executionService,
    approvalService,
    checkpointService,
    encryption,
    routerService
  };
}

export async function createServiceContainer(env: AppEnv): Promise<ServiceContainer> {
  const repositories = await createDatabaseRepositories(env.DATABASE_URL);
  const eventBus = createEventBus();
  const encryption = createEncryptionService(env.MYCELIUM_ENCRYPTION_KEY);
  const routerService = createRouterService({ repositories });
  const workspaceManager = new WorkspaceManager({
    rootPath: env.WORKSPACE_ROOT
  });
  const checkpointService = createCheckpointService({
    repositories,
    eventBus,
    checkpointStore: new LocalFilesystemCheckpointStore({
      rootDir: env.CHECKPOINT_ROOT
    })
  });
  const sandboxProvider = new LocalDockerProvider(
    env.SANDBOX_IMAGE ? { image: env.SANDBOX_IMAGE } : {}
  );
  const executionService = createExecutionService({
    repositories,
    eventBus,
    checkpointService,
    sandboxProvider,
    workspaceManager
  });
  const approvalService = createApprovalService({
    repositories,
    eventBus,
    checkpointService,
    executionService
  });

  await executionService.recoverInterruptedRuns();

  return {
    repositories,
    eventBus,
    executionService,
    approvalService,
    checkpointService,
    encryption,
    routerService
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
