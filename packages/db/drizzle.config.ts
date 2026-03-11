import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://postgres:REPLACE_WITH_LOCAL_DB_PASSWORD@127.0.0.1:54321/computer_oss"
  }
});
