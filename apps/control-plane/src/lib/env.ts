import { z } from "zod";

const BooleanFromStringSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return value;
}, z.boolean());

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.string().optional(),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  WORKSPACE_ROOT: z.string().min(1).default(".mycelium/workspaces"),
  CHECKPOINT_ROOT: z.string().min(1).default(".mycelium/checkpoints"),
  SANDBOX_IMAGE: z.string().min(1).optional(),
  MYCELIUM_ENCRYPTION_KEY: z.string().min(1).optional(),
  MYCELIUM_DAEMON_TOKEN: z.string().min(1).default("local-daemon-token"),
  MYCELIUM_DEV_SIMULATION_MODE: BooleanFromStringSchema.optional(),
  MYCELIUM_WORKER_STALE_TIMEOUT_MS: z.coerce.number()
    .int()
    .positive()
    .default(60_000)
});

type ParsedEnv = z.infer<typeof EnvSchema>;

export type AppEnv = Omit<ParsedEnv, "MYCELIUM_DEV_SIMULATION_MODE"> & {
  MYCELIUM_DEV_SIMULATION_MODE: boolean;
};

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.parse(env);

  return {
    ...parsed,
    MYCELIUM_DEV_SIMULATION_MODE:
      parsed.MYCELIUM_DEV_SIMULATION_MODE ?? parsed.NODE_ENV === "development"
  };
}
