import Fastify from "fastify";
import type { EventBus } from "./lib/event-bus";
import type { ExecutionService } from "./lib/execution-service";
import { createMessagingService } from "./lib/messaging-service";
import { createOutcomeTurnService } from "./lib/outcome-turn-service";
import type { Repositories } from "./lib/repositories";
import {
  createInMemoryServiceContainer,
  type ServiceContainer
} from "./lib/service-container";
import { createSlackService } from "./lib/slack-service";
import { createTelegramService } from "./lib/telegram-service";
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
import { registerSlackRoutes } from "./routes/slack";
import { registerScheduleRoutes } from "./routes/schedules";
import { registerTelegramRoutes } from "./routes/telegram";
import { registerWorkspaceCredentialRoutes } from "./routes/workspace-credentials";
import { registerMessageRoutes } from "./routes/messages";
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
  const messagingService =
    services.messagingService ??
    createMessagingService({
      repositories,
      eventBus,
      adapters: {
        slack: {
          transport: "socket_mode",
          async deliver() {
            return undefined;
          }
        },
        telegram: {
          transport: "long_polling",
          async deliver() {
            return undefined;
          }
        }
      }
    });
  const slackService =
    services.slackService ?? createSlackService({ messagingService });
  const telegramService =
    services.telegramService ?? createTelegramService({ messagingService });
  const workerRegistry = services.workerRegistry;
  const daemonGateway = services.daemonGateway;
  const daemonAuthToken = services.daemonAuthToken;
  const remoteProvider = services.remoteProvider;
  const simulatedExecutionService = services.simulatedExecutionService;
  const simulationMode = services.simulationMode;
  const outcomeTurnService = createOutcomeTurnService({
    repositories,
    eventBus,
    executionService,
    routerService,
    simulatedExecutionService,
    simulationMode
  });

  app.decorate("outcomeTurnService", outcomeTurnService);

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
  registerSlackRoutes(app, { slackService });
  registerTelegramRoutes(app, { telegramService });
  registerMessageRoutes(app, { messagingService });
  registerOutcomeRoutes(app, { repositories, eventBus });
  registerPlanRoutes(app, { repositories, eventBus, simulationMode });
  registerCheckpointRoutes(app, { repositories, checkpointService });
  registerRunRoutes(app, {
    repositories,
    eventBus,
    executionService,
    routerService,
    simulatedExecutionService,
    simulationMode
  });
  registerArtifactRoutes(app, { repositories });
  registerOutcomeEventRoutes(app, { repositories, eventBus });

  app.addHook("onReady", async () => {
    await services.scheduleService.start();
  });

  app.addHook("onClose", async () => {
    services.scheduleService.close();
    messagingService.close();
    slackService.close();
    telegramService.close();
    services.workerRegistry.close();
    simulatedExecutionService.close();
  });

  return app;
}
