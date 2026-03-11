import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

export type DatabaseClient = PostgresJsDatabase<typeof schema>;
export type QueryClient = Sql<Record<string, never>>;

export function createQueryClient(connectionString: string): QueryClient {
  return postgres(connectionString, {
    max: 1
  });
}

export function createDatabaseClient(connectionString: string): DatabaseClient {
  const queryClient = createQueryClient(connectionString);
  return drizzle(queryClient, { schema });
}
