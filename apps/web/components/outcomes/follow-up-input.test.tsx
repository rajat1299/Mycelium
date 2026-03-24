import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FollowUpInput } from "./follow-up-input";

afterEach(() => {
  cleanup();
});

describe("FollowUpInput", () => {
  it("disables submission controls when the current outcome is still active", () => {
    render(
      <FollowUpInput
        action={vi.fn().mockResolvedValue(undefined)}
        disabled
        hasConversation
      />
    );

    expect(screen.getByLabelText("Send")).toBeDisabled();
    expect(screen.getByPlaceholderText("Type a command...")).toBeDisabled();
    expect(screen.getByLabelText("Attach file")).toBeDisabled();
    expect(screen.getByLabelText("Voice input")).toBeDisabled();
    expect(screen.getByLabelText("Helpful")).toBeDisabled();
  });
});
