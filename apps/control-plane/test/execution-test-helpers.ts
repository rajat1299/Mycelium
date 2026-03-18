import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildApp } from "../src/app";
import { createApprovalService } from "../src/lib/approval-service";
import { createCheckpointService } from "../src/lib/checkpoint-service";
import { createDaemonGateway } from "../src/lib/daemon-gateway";
import { createEncryptionService } from "../src/lib/encryption";
import { createEventBus } from "../src/lib/event-bus";
import { createExecutionService } from "../src/lib/execution-service";
import { createRouterService } from "../src/lib/router-service";
import { createScheduleService } from "../src/lib/schedule-service";
import { createWorkerRegistry } from "../src/lib/worker-registry";
import { LocalFilesystemCheckpointStore } from "@computer-oss/checkpoints";
import { RemoteProvider } from "@computer-oss/sandbox";
import {
  createInMemoryRepositories,
  type Repositories
} from "../src/lib/repositories";
import type { ServiceContainer } from "../src/lib/service-container";

const TEST_ENCRYPTION_KEY = "12345678901234567890123456789012";

type FakeSandboxRequest = {
  runId: string;
  step: {
    id: string;
    planNodeId: string;
    expectedArtifactPath?: string;
  };
  workspace: {
    rootPath: string;
  };
};

type FakeSandboxResult = {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  artifactBody?: string;
  producedArtifactPaths?: string[];
};

type FakeSandboxOptions = {
  onExecute?: (request: FakeSandboxRequest) => Promise<FakeSandboxResult> | FakeSandboxResult;
  repositories?: Repositories;
  eventBus?: ReturnType<typeof createEventBus>;
  workspaceManager?: {
    acquire(runId: string): Promise<{
      runId: string;
      acquiredAt: string;
      paths: {
        rootPath: string;
        inputPath: string;
        artifactsPath: string;
        logsPath: string;
      };
    }>;
    release(runId: string): void;
  };
};

export function createFakeSandboxProvider(options: FakeSandboxOptions = {}) {
  const startedPlanNodeIds: string[] = [];

  return {
    startedPlanNodeIds,
    provider: {
      async execute(request: FakeSandboxRequest) {
        startedPlanNodeIds.push(request.step.planNodeId);

        const startedAt = new Date("2026-03-12T00:10:00.000Z").toISOString();
        const behavior = await options.onExecute?.(request);
        const producedArtifactPaths =
          behavior?.producedArtifactPaths ??
          (request.step.expectedArtifactPath ? [request.step.expectedArtifactPath] : []);

        for (const relativePath of producedArtifactPaths) {
          const absolutePath = resolve(request.workspace.rootPath, relativePath);
          await mkdir(dirname(absolutePath), { recursive: true });
          await writeFile(
            absolutePath,
            behavior?.artifactBody ??
              `artifact for ${request.step.planNodeId}\n`
          );
        }

        return {
          containerName: `fake-${request.step.id}`,
          exitCode: behavior?.exitCode ?? 0,
          stdout:
            behavior?.stdout ??
            `completed ${request.step.planNodeId}`,
          stderr: behavior?.stderr ?? "",
          startedAt,
          finishedAt: startedAt,
          durationMs: 0,
          producedArtifactPaths
        };
      }
    }
  };
}

export async function createExecutionHarness(
  options: FakeSandboxOptions = {}
) {
  const workspaceRootPath = await mkdtemp(
    join(tmpdir(), "mycelium-control-plane-")
  );
  const eventBus = options.eventBus ?? createEventBus();
  const fakeSandbox = createFakeSandboxProvider(options);
  const repositories = options.repositories ?? createInMemoryRepositories();
  const workspaceManager =
    options.workspaceManager ??
    {
      async acquire(runId: string) {
        const rootPath = resolve(workspaceRootPath, runId);

        return {
          runId,
          acquiredAt: new Date().toISOString(),
          paths: {
            rootPath,
            inputPath: resolve(rootPath, "input"),
            artifactsPath: resolve(rootPath, "artifacts"),
            logsPath: resolve(rootPath, "logs")
          }
        };
      },
      release(_runId: string) {
        return;
      }
    };
  const checkpointService = createCheckpointService({
    repositories,
    eventBus,
    checkpointStore: new LocalFilesystemCheckpointStore({
      rootDir: resolve(workspaceRootPath, ".checkpoints")
    })
  });
  const remoteProvider = new RemoteProvider({
    fallbackProvider: fakeSandbox.provider as never
  });
  const executionService = createExecutionService({
    repositories,
    eventBus,
    checkpointService,
    sandboxProvider: remoteProvider,
    workspaceManager: workspaceManager as never
  });
  const approvalService = createApprovalService({
    repositories,
    eventBus,
    checkpointService,
    executionService
  });
  const workerRegistry = createWorkerRegistry({
    repositories,
    eventBus
  });
  const routerService = createRouterService({ repositories });
  const scheduleService = createScheduleService({
    repositories,
    eventBus,
    executionService,
    routerService
  });
  const daemonGateway = createDaemonGateway({
    repositories,
    eventBus,
    workerRegistry
  });
  const services: ServiceContainer = {
    repositories,
    eventBus,
    encryption: createEncryptionService(TEST_ENCRYPTION_KEY),
    routerService,
    scheduleService,
    checkpointService,
    executionService,
    approvalService,
    workerRegistry,
    daemonGateway,
    daemonAuthToken: "test-daemon-token",
    remoteProvider
  };
  const events: Array<{ outcomeId: string; type: string; data: unknown }> = [];
  const unsubscribe = eventBus.subscribeAll((event) => {
    events.push(event);
  });
  const app = buildApp({ services });

  return {
    app,
    services,
    events,
    fakeSandbox,
    async cleanup() {
      unsubscribe();
      await app.close();
      await rm(workspaceRootPath, { recursive: true, force: true });
    }
  };
}

export async function createOutcomeAndPlan(
  app: Awaited<ReturnType<typeof createExecutionHarness>>["app"],
  prompt = "Ship the launch brief and summary."
) {
  const createOutcome = await app.inject({
    method: "POST",
    url: "/api/outcomes",
    payload: {
      workspaceId: "ws_123",
      userId: "user_123",
      prompt,
      source: "web"
    }
  });
  const outcome = createOutcome.json();

  const createPlan = await app.inject({
    method: "POST",
    url: `/api/outcomes/${outcome.id}/plan`
  });
  const plan = createPlan.json();

  return { outcome, plan };
}
