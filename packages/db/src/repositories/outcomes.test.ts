import { describe, expect, it } from "vitest";
import { OutcomeRepository } from "./outcomes";
import { outcomeMessages, outcomes, users, workspaces } from "../schema";

describe("OutcomeRepository", () => {
  it("creates default workspace and user records before inserting an outcome", async () => {
    const operations: Array<{ table: string; values: Record<string, unknown> }> = [];
    const createdAt = new Date("2026-03-11T00:00:00.000Z");

    function tableName(table: typeof outcomes | typeof users | typeof workspaces) {
      if (table === workspaces) {
        return "workspaces";
      }

      if (table === users) {
        return "users";
      }

      return "outcomes";
    }

    const db = {
      insert(table: typeof outcomes | typeof users | typeof workspaces) {
        return {
          values(values: Record<string, unknown>) {
            operations.push({
              table: tableName(table),
              values
            });

            if (table === outcomes) {
              return {
                async returning() {
                  return [
                    {
                      id: values.id,
                      workspaceId: values.workspaceId,
                      userId: values.userId,
                      prompt: values.prompt,
                      source: values.source,
                      status: values.status,
                      createdAt,
                      updatedAt: createdAt
                    }
                  ];
                }
              };
            }

            return {
              async onConflictDoNothing() {
                return;
              }
            };
          }
        };
      }
    };

    const repository = new OutcomeRepository(db as never);

    await repository.create({
      id: "outcome_123",
      workspaceId: "ws_default",
      userId: "user_default",
      prompt: "Draft a smoke-path memo",
      source: "web"
    });

    expect(operations).toEqual([
      {
        table: "workspaces",
        values: {
          id: "ws_default",
          name: "Workspace ws_default"
        }
      },
      {
        table: "users",
        values: {
          id: "user_default",
          email: "user_default@local.mycelium"
        }
      },
      {
        table: "outcomes",
        values: {
          id: "outcome_123",
          workspaceId: "ws_default",
          userId: "user_default",
          prompt: "Draft a smoke-path memo",
          source: "web",
          status: "draft"
        }
      }
    ]);
  });

  it("updates outcome status and timestamp", async () => {
    const updatedAt = new Date("2026-03-11T00:15:00.000Z");
    const db = {
      update(table: typeof outcomes) {
        expect(table).toBe(outcomes);

        return {
          set(values: Record<string, unknown>) {
            expect(values).toEqual({
              status: "queued",
              updatedAt
            });

            return {
              where() {
                return {
                  async returning() {
                    return [
                      {
                        id: "outcome_123",
                        workspaceId: "ws_default",
                        userId: "user_default",
                        prompt: "Draft a smoke-path memo",
                        source: "web",
                        status: "queued",
                        createdAt: new Date("2026-03-11T00:00:00.000Z"),
                        updatedAt
                      }
                    ];
                  }
                };
              }
            };
          }
        };
      }
    };

    const repository = new OutcomeRepository(db as never);
    const outcome = await repository.updateStatus({
      id: "outcome_123",
      status: "queued",
      updatedAt: updatedAt.toISOString()
    });

    expect(outcome).toEqual(
      expect.objectContaining({
        id: "outcome_123",
        status: "queued",
        updatedAt: "2026-03-11T00:15:00.000Z"
      })
    );
  });

  it("fetches outcome messages by id and in chronological order", async () => {
    const state = {
      outcomeMessages: [] as Array<Record<string, unknown>>
    };
    const db = {
      insert(table: typeof outcomeMessages) {
        expect(table).toBe(outcomeMessages);

        return {
          values(values: Record<string, unknown>) {
            state.outcomeMessages.push(values);
            return Promise.resolve();
          }
        };
      },
      select() {
        return {
          from(table: typeof outcomeMessages) {
            expect(table).toBe(outcomeMessages);
            return Promise.resolve(state.outcomeMessages);
          }
        };
      }
    };
    const repository = new OutcomeRepository(db as never);

    await repository.appendMessage({
      id: "msg_001",
      outcomeId: "outcome_123",
      role: "user",
      content: "First turn",
      createdAt: "2026-03-11T00:01:00.000Z"
    });
    await repository.appendMessage({
      id: "msg_002",
      outcomeId: "outcome_123",
      role: "assistant",
      content: "Second turn",
      createdAt: "2026-03-11T00:02:00.000Z"
    });

    await expect(repository.getMessageById("msg_001")).resolves.toEqual({
      id: "msg_001",
      outcomeId: "outcome_123",
      role: "user",
      content: "First turn",
      createdAt: "2026-03-11T00:01:00.000Z"
    });

    await expect(repository.listMessages("outcome_123")).resolves.toEqual([
      {
        id: "msg_001",
        outcomeId: "outcome_123",
        role: "user",
        content: "First turn",
        createdAt: "2026-03-11T00:01:00.000Z"
      },
      {
        id: "msg_002",
        outcomeId: "outcome_123",
        role: "assistant",
        content: "Second turn",
        createdAt: "2026-03-11T00:02:00.000Z"
      }
    ]);
  });
});
