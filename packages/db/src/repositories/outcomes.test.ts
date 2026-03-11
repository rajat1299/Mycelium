import { describe, expect, it } from "vitest";
import { OutcomeRepository } from "./outcomes";
import { outcomes, users, workspaces } from "../schema";

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
});
