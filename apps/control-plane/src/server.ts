import { buildApp } from "./app";
import { loadEnv } from "./lib/env";
import { createDatabaseRepositories } from "./lib/repositories";

async function start() {
  const env = loadEnv();
  const repositories = await createDatabaseRepositories(env.DATABASE_URL);
  const app = buildApp({ repositories });

  await app.listen({
    host: env.HOST,
    port: env.PORT
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
