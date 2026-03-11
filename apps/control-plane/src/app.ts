import Fastify from "fastify";
import { createEventBus, type EventBus } from "./lib/event-bus";
import {
  createInMemoryRepositories,
  type Repositories
} from "./lib/repositories";
import { registerHealthRoutes } from "./routes/health";
import { registerOutcomeEventRoutes } from "./routes/outcome-events";
import { registerOutcomeRoutes } from "./routes/outcomes";

type BuildAppOptions = {
  repositories?: Repositories;
  eventBus?: EventBus;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify();
  const repositories = options.repositories ?? createInMemoryRepositories();
  const eventBus = options.eventBus ?? createEventBus();

  registerHealthRoutes(app);
  registerOutcomeRoutes(app, { repositories, eventBus });
  registerOutcomeEventRoutes(app, { repositories, eventBus });

  return app;
}
