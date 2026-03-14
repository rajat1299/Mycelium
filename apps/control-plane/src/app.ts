import Fastify from "fastify";
import type { EventBus } from "./lib/event-bus";
import type { ExecutionService } from "./lib/execution-service";
import type { Repositories } from "./lib/repositories";
import {
  createInMemoryServiceContainer,
  type ServiceContainer
} from "./lib/service-container";
import { registerAuthProfileRoutes } from "./routes/auth-profiles";
import { registerArtifactRoutes } from "./routes/artifacts";
import { registerHealthRoutes } from "./routes/health";
import { registerOutcomeEventRoutes } from "./routes/outcome-events";
import { registerOutcomeRoutes } from "./routes/outcomes";
import { registerPlanRoutes } from "./routes/plans";
import { registerProviderRoutes } from "./routes/providers";
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
  const encryption = services.encryption;

  registerHealthRoutes(app);
  registerProviderRoutes(app);
  registerWorkspaceCredentialRoutes(app, { repositories, encryption });
  registerAuthProfileRoutes(app, { repositories, encryption });
  registerOutcomeRoutes(app, { repositories, eventBus });
  registerPlanRoutes(app, { repositories, eventBus });
  registerRunRoutes(app, { repositories, eventBus, executionService });
  registerArtifactRoutes(app, { repositories });
  registerOutcomeEventRoutes(app, { repositories, eventBus });

  return app;
}
