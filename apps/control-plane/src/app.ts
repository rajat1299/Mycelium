import Fastify from "fastify";
import type { EventBus } from "./lib/event-bus";
import type { ExecutionService } from "./lib/execution-service";
import type { Repositories } from "./lib/repositories";
import {
  createInMemoryServiceContainer,
  type ServiceContainer
} from "./lib/service-container";
import { registerApprovalRoutes } from "./routes/approvals";
import { registerAuthProfileRoutes } from "./routes/auth-profiles";
import { registerArtifactRoutes } from "./routes/artifacts";
import { registerCheckpointRoutes } from "./routes/checkpoints";
import { registerHealthRoutes } from "./routes/health";
import { registerOutcomeEventRoutes } from "./routes/outcome-events";
import { registerOutcomeRoutes } from "./routes/outcomes";
import { registerPlanRoutes } from "./routes/plans";
import { registerProviderRoutes } from "./routes/providers";
import { registerRouterRoutes } from "./routes/router";
import { registerScheduleRoutes } from "./routes/schedules";
import { registerWorkspaceCredentialRoutes } from "./routes/workspace-credentials";
import { registerRunRoutes } from "./routes/runs";
import { registerWorkerDaemonRoutes } from "./routes/worker-daemon";
import { registerWorkerRoutes } from "./routes/workers";

type BuildAppOptions = {
  services?: ServiceContainer;
  repositories?: Repositories;
  eventBus?: EventBus;
  executionService?: ExecutionService;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify();
  const services =
    options.services ??
    createInMemoryServiceContainer({
      ...(options.repositories ? { repositories: options.repositories } : {}),
      ...(options.eventBus ? { eventBus: options.eventBus } : {})
    });
  const repositories =
    options.repositories ?? services.repositories;
  const eventBus = options.eventBus ?? services.eventBus;
  const executionService =
    options.executionService ?? services.executionService;
  const approvalService = services.approvalService;
  const checkpointService = services.checkpointService;
  const encryption = services.encryption;
  const routerService = services.routerService;
  const scheduleService = services.scheduleService;
  const workerRegistry = services.workerRegistry;
  const daemonGateway = services.daemonGateway;
  const daemonAuthToken = services.daemonAuthToken;
  const remoteProvider = services.remoteProvider;

  registerHealthRoutes(app);
  registerProviderRoutes(app);
  registerWorkerDaemonRoutes(app, {
    daemonGateway,
    daemonAuthToken,
    remoteProvider
  });
  registerWorkerRoutes(app, { workerRegistry });
  registerApprovalRoutes(app, { repositories, approvalService });
  registerWorkspaceCredentialRoutes(app, { repositories, encryption });
  registerAuthProfileRoutes(app, { repositories, encryption });
  registerRouterRoutes(app, { routerService });
  registerScheduleRoutes(app, { scheduleService });
  registerOutcomeRoutes(app, { repositories, eventBus });
  registerPlanRoutes(app, { repositories, eventBus });
  registerCheckpointRoutes(app, { repositories, checkpointService });
  registerRunRoutes(app, {
    repositories,
    eventBus,
    executionService,
    routerService
  });
  registerArtifactRoutes(app, { repositories });
  registerOutcomeEventRoutes(app, { repositories, eventBus });

  app.addHook("onReady", async () => {
    await services.scheduleService.start();
  });

  app.addHook("onClose", async () => {
    services.scheduleService.close();
    services.workerRegistry.close();
  });

  return app;
}
