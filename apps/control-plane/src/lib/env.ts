import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  WORKSPACE_ROOT: z.string().min(1).default(".mycelium/workspaces"),
  CHECKPOINT_ROOT: z.string().min(1).default(".mycelium/checkpoints"),
  SANDBOX_IMAGE: z.string().min(1).optional(),
  MYCELIUM_ENCRYPTION_KEY: z.string().min(1).optional()
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  return EnvSchema.parse(env);
}
