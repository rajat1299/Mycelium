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
import { registerHealthRoutes } from "./routes/health";
import { registerOutcomeEventRoutes } from "./routes/outcome-events";
import { registerOutcomeRoutes } from "./routes/outcomes";
import { registerPlanRoutes } from "./routes/plans";
import { registerProviderRoutes } from "./routes/providers";
import { registerRouterRoutes } from "./routes/router";
import { registerWorkspaceCredentialRoutes } from "./routes/workspace-credentials";
import { registerRunRoutes } from "./routes/runs";

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
  const encryption = services.encryption;
  const routerService = services.routerService;

  registerHealthRoutes(app);
  registerProviderRoutes(app);
  registerApprovalRoutes(app, { repositories, approvalService });
  registerWorkspaceCredentialRoutes(app, { repositories, encryption });
  registerAuthProfileRoutes(app, { repositories, encryption });
  registerRouterRoutes(app, { routerService });
  registerOutcomeRoutes(app, { repositories, eventBus });
  registerPlanRoutes(app, { repositories, eventBus });
  registerRunRoutes(app, {
    repositories,
    eventBus,
    executionService,
    routerService
  });
  registerArtifactRoutes(app, { repositories });
  registerOutcomeEventRoutes(app, { repositories, eventBus });

  return app;
}
