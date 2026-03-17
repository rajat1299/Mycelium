import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { LocalArtifactStore } from "@computer-oss/artifacts";
import { LocalFilesystemCheckpointStore } from "@computer-oss/checkpoints";
import {
  ArtifactSchema,
  RunLogDataSchema
} from "@computer-oss/protocol";
import type { SandboxProvider } from "@computer-oss/sandbox";
import {
  LocalDockerProvider,
  RemoteProvider,
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
  createDaemonGateway,
  type DaemonGateway
} from "./daemon-gateway";
import {
  createExecutionService,
  type ExecutionService
} from "./execution-service";
import {
  createRouterService,
  type RouterService
} from "./router-service";
import {
  createWorkerRegistry,
  type WorkerRegistry
} from "./worker-registry";
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
  workerRegistry: WorkerRegistry;
  daemonGateway: DaemonGateway;
  daemonAuthToken: string;
  remoteProvider: RemoteProvider;
};

type InMemoryServiceContainerOptions = {
  repositories?: Repositories;
  eventBus?: EventBus;
  sandboxProvider?: SandboxProvider;
  workspaceRootPath?: string;
  encryptionKey?: string;
  daemonAuthToken?: string;
  workerStaleTimeoutMs?: number;
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
  const remoteProvider =
    options.sandboxProvider instanceof RemoteProvider
      ? options.sandboxProvider
      : new RemoteProvider({
          fallbackProvider: options.sandboxProvider ?? createInlineSandboxProvider()
        });
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
  const workerRegistry = createWorkerRegistry({
    repositories,
    eventBus,
    ...(options.now ? { now: options.now } : {}),
    ...(options.workerStaleTimeoutMs
      ? { staleAfterMs: options.workerStaleTimeoutMs }
      : {})
  });
  const daemonGateway = createDaemonGateway({
    repositories,
    eventBus,
    workerRegistry,
    onDisconnectWorker(input) {
      remoteProvider.interruptWorkerSession({
        workerId: input.workerId,
        workerSessionId: input.workerSessionId,
        message: `Remote worker ${input.workerId} disconnected.`
      });
    },
    async onLogEvent(event, context) {
      const data = RunLogDataSchema.parse({
        runId: context.runId,
        stepId: context.step.id,
        stepTitle: context.step.title,
        level: event.level,
        message: event.message,
        createdAt: event.createdAt
      });

      await repositories.runs.appendEvent({
        id: `event_${randomUUID()}`,
        runId: data.runId,
        eventType: "run.log",
        payload: data,
        createdAt: data.createdAt
      });
    },
    async onArtifactEvent(event, context) {
      const lease = await repositories.workspaceLeases.getActiveByRun(context.runId);

      if (!lease) {
        remoteProvider.recordArtifactUpload(event);
        return;
      }

      const artifactStore = new LocalArtifactStore({
        rootPath: lease.rootPath
      });
      const written = await artifactStore.put({
        relativePath: event.artifact.relativePath,
        body: Buffer.from(event.artifact.contentBase64, "base64")
      });
      const artifact = await repositories.artifacts.create({
        id: `artifact_${randomUUID()}`,
        outcomeId: context.outcomeId,
        runId: context.runId,
        stepId: context.step.id,
        kind: event.artifact.kind,
        relativePath: written.relativePath,
        size: written.size,
        metadata: {
          workerId: event.workerId,
          stepTitle: context.step.title,
          ...(event.artifact.metadata ?? {})
        },
        createdAt: event.artifact.createdAt
      });

      await repositories.runs.appendEvent({
        id: `event_${randomUUID()}`,
        runId: context.runId,
        eventType: "artifact.created",
        payload: artifact,
        createdAt: artifact.createdAt
      });

      eventBus.publish({
        outcomeId: context.outcomeId,
        type: "artifact.created",
        data: ArtifactSchema.parse(artifact)
      });
      remoteProvider.recordArtifactUpload(event);
    },
    async onCheckpointEvent(event, context) {
      await checkpointService.createUploadedCheckpoint({
        runId: context.runId,
        kind: event.checkpoint.kind,
        stepId: context.step.id,
        createdAt: event.checkpoint.createdAt,
        payload: event.checkpoint.payload
      });
      remoteProvider.recordCheckpointUpload(event);
    },
    async onTerminalEvent(event) {
      remoteProvider.completeAttempt(event);
    }
  });
  const executionService = createExecutionService({
    repositories,
    eventBus,
    checkpointService,
    sandboxProvider: remoteProvider,
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
  const daemonAuthToken = options.daemonAuthToken ?? "test-daemon-token";

  return {
    repositories,
    eventBus,
    executionService,
    approvalService,
    checkpointService,
    encryption,
    routerService,
    workerRegistry,
    daemonGateway,
    daemonAuthToken,
    remoteProvider
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
  const workerRegistry = createWorkerRegistry({
    repositories,
    eventBus,
    staleAfterMs: env.MYCELIUM_WORKER_STALE_TIMEOUT_MS
  });
  const remoteProvider = new RemoteProvider({
    fallbackProvider: new LocalDockerProvider(
      env.SANDBOX_IMAGE ? { image: env.SANDBOX_IMAGE } : {}
    )
  });
  const executionService = createExecutionService({
    repositories,
    eventBus,
    checkpointService,
    sandboxProvider: remoteProvider,
    workspaceManager
  });
  const daemonGateway = createDaemonGateway({
    repositories,
    eventBus,
    workerRegistry,
    onDisconnectWorker(input) {
      remoteProvider.interruptWorkerSession({
        workerId: input.workerId,
        workerSessionId: input.workerSessionId,
        message: `Remote worker ${input.workerId} disconnected.`
      });
    },
    async onLogEvent(event, context) {
      const data = RunLogDataSchema.parse({
        runId: context.runId,
        stepId: context.step.id,
        stepTitle: context.step.title,
        level: event.level,
        message: event.message,
        createdAt: event.createdAt
      });

      await repositories.runs.appendEvent({
        id: `event_${randomUUID()}`,
        runId: data.runId,
        eventType: "run.log",
        payload: data,
        createdAt: data.createdAt
      });
    },
    async onArtifactEvent(event, context) {
      const lease = await repositories.workspaceLeases.getActiveByRun(context.runId);

      if (!lease) {
        remoteProvider.recordArtifactUpload(event);
        return;
      }

      const artifactStore = new LocalArtifactStore({
        rootPath: lease.rootPath
      });
      const written = await artifactStore.put({
        relativePath: event.artifact.relativePath,
        body: Buffer.from(event.artifact.contentBase64, "base64")
      });
      const artifact = await repositories.artifacts.create({
        id: `artifact_${randomUUID()}`,
        outcomeId: context.outcomeId,
        runId: context.runId,
        stepId: context.step.id,
        kind: event.artifact.kind,
        relativePath: written.relativePath,
        size: written.size,
        metadata: {
          workerId: event.workerId,
          stepTitle: context.step.title,
          ...(event.artifact.metadata ?? {})
        },
        createdAt: event.artifact.createdAt
      });

      await repositories.runs.appendEvent({
        id: `event_${randomUUID()}`,
        runId: context.runId,
        eventType: "artifact.created",
        payload: artifact,
        createdAt: artifact.createdAt
      });

      eventBus.publish({
        outcomeId: context.outcomeId,
        type: "artifact.created",
        data: ArtifactSchema.parse(artifact)
      });
      remoteProvider.recordArtifactUpload(event);
    },
    async onCheckpointEvent(event, context) {
      await checkpointService.createUploadedCheckpoint({
        runId: context.runId,
        kind: event.checkpoint.kind,
        stepId: context.step.id,
        createdAt: event.checkpoint.createdAt,
        payload: event.checkpoint.payload
      });
      remoteProvider.recordCheckpointUpload(event);
    },
    async onTerminalEvent(event) {
      remoteProvider.completeAttempt(event);
    }
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
    routerService,
    workerRegistry,
    daemonGateway,
    daemonAuthToken: env.MYCELIUM_DAEMON_TOKEN,
    remoteProvider
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
