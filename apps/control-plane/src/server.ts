import { buildApp } from "./app";
import { loadEnv } from "./lib/env";
import { createServiceContainer } from "./lib/service-container";

async function start() {
  const env = loadEnv();
  const services = await createServiceContainer(env);
  const app = buildApp({ services });

  await app.listen({
    host: env.HOST,
    port: env.PORT
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
