import Fastify from "fastify";
import {
  createInMemoryRepositories,
  type Repositories
} from "./lib/repositories";
import { registerHealthRoutes } from "./routes/health";
import { registerOutcomeRoutes } from "./routes/outcomes";

type BuildAppOptions = {
  repositories?: Repositories;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify();
  const repositories = options.repositories ?? createInMemoryRepositories();

  void registerHealthRoutes(app);
  void registerOutcomeRoutes(app, { repositories });

  return app;
}
