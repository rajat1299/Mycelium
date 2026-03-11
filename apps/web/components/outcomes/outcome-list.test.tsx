import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OutcomeList } from "./outcome-list";

describe("OutcomeList", () => {
  it("renders outcome prompts and statuses", () => {
    render(
      <OutcomeList
        outcomes={[
          {
            id: "outcome_1",
            prompt: "Prepare release notes",
            status: "running",
            updatedAt: "2026-03-11T00:00:00.000Z"
          }
        ]}
      />
    );

    expect(screen.getByText("Prepare release notes")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});
