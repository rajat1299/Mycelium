import type {
  CreateOutcomeMessageRequest,
  CreateOutcomeRequest,
  Outcome
} from "@computer-oss/protocol";

export type CreateStoredOutcomeInput = CreateOutcomeRequest & { id: string };

export type AppendOutcomeMessageInput = CreateOutcomeMessageRequest & {
  id: string;
  outcomeId: string;
  createdAt: string;
};

export type OutcomeStore = {
  create(input: CreateStoredOutcomeInput): Promise<Outcome>;
  getById(id: string): Promise<Outcome | null>;
  listByWorkspace(workspaceId: string): Promise<Outcome[]>;
  appendMessage(input: AppendOutcomeMessageInput): Promise<void>;
};

export type Repositories = {
  outcomes: OutcomeStore;
};

function createInMemoryOutcomeStore(): OutcomeStore {
  const outcomes = new Map<string, Outcome>();

  return {
    async create(input) {
      const now = new Date().toISOString();
      const outcome: Outcome = {
        ...input,
        status: "draft",
        createdAt: now,
        updatedAt: now
      };

      outcomes.set(outcome.id, outcome);
      return outcome;
    },
    async getById(id) {
      return outcomes.get(id) ?? null;
    },
    async listByWorkspace(workspaceId) {
      return Array.from(outcomes.values()).filter(
        (outcome) => outcome.workspaceId === workspaceId
      );
    },
    async appendMessage(_input) {
      return;
    }
  };
}

export function createInMemoryRepositories(): Repositories {
  return {
    outcomes: createInMemoryOutcomeStore()
  };
}

export async function createDatabaseRepositories(
  connectionString: string
): Promise<Repositories> {
  const { OutcomeRepository, createDatabaseClient } = await import("@computer-oss/db");
  const db = createDatabaseClient(connectionString);

  return {
    outcomes: new OutcomeRepository(db)
  };
}
