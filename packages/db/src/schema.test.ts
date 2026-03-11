import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { outcomeStatusEnum, outcomes } from "./index";

describe("db schema", () => {
  it("exports the outcome table and status enum", () => {
    expect(getTableName(outcomes)).toBe("outcomes");
    expect(outcomeStatusEnum.enumValues).toContain("draft");
    expect(outcomeStatusEnum.enumValues).toContain("running");
  });
});
