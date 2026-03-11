import { spawn } from "node:child_process";
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:REPLACE_WITH_LOCAL_DB_PASSWORD@127.0.0.1:54321/computer_oss";
const maxAttempts = 30;
const delayMs = 1000;

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabase() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const sql = postgres(connectionString, {
      connect_timeout: 1,
      idle_timeout: 1,
      max: 1
    });

    try {
      await sql`select 1`;
      await sql.end({ timeout: 1 });
      return;
    } catch (error) {
      await sql.end({ timeout: 1 }).catch(() => undefined);

      if (attempt === maxAttempts) {
        throw error;
      }

      await sleep(delayMs);
    }
  }
}

function runDrizzlePush() {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const child = spawn(command, ["exec", "drizzle-kit", "push", "--config=drizzle.config.ts"], {
    stdio: "inherit"
  });

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
}

await waitForDatabase();
runDrizzlePush();
