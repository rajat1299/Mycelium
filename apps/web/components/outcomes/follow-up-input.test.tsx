import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
        initialSubmissionId="submit_initial"
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

  it("submits a real hidden submission id and rotates it after a successful submit", async () => {
    const action = vi.fn(async (formData: FormData) => {
      expect(formData.get("submissionId")).toBe("submit_initial");
      expect(formData.get("content")).toBe("Make it shorter.");
    });

    render(
      <FollowUpInput
        action={action}
        initialSubmissionId="submit_initial"
      />
    );

    const input = screen.getByPlaceholderText("Type a command...");
    Object.defineProperty(input, "scrollHeight", {
      configurable: true,
      value: 20
    });
    fireEvent.input(input, {
      target: {
        value: "Make it shorter."
      }
    });

    const form = input.closest("form");

    expect(screen.getByDisplayValue("submit_initial")).toHaveAttribute(
      "type",
      "hidden"
    );

    if (!form) {
      throw new Error("Expected follow-up form to exist.");
    }

    await act(async () => {
      form.requestSubmit();
      await Promise.resolve();
    });

    expect(action).toHaveBeenCalledTimes(1);
    const nextSubmissionField = screen.getByDisplayValue(/submit_/);
    expect(nextSubmissionField).not.toHaveValue("submit_initial");
  });
});
