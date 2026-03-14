import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthProfile } from "@computer-oss/protocol";
import { RoutePreviewPanel } from "./route-preview-panel";

const fetchMock = vi.fn();

const authProfiles: AuthProfile[] = [
  {
    id: "profile_openai_primary",
    workspaceId: "ws_default",
    providerId: "openai",
    label: "OpenAI Primary",
    credentialId: "cred_openai_primary",
    status: "active" as const,
    priority: 1,
    cooldownUntil: null,
    lastValidatedAt: null,
    createdAt: "2026-03-14T00:00:00.000Z",
    updatedAt: "2026-03-14T00:00:00.000Z"
  }
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RoutePreviewPanel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders a resolved route preview", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          workspaceId: "ws_default",
          capability: "reasoning",
          route: {
            capability: "reasoning",
            providerId: "openai",
            modelId: "gpt-5.4",
            authProfileId: "profile_openai_primary",
            policyVersion: 2,
            status: "resolved",
            reason: null,
            resolvedAt: "2026-03-14T00:30:00.000Z"
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    render(
      <RoutePreviewPanel
        workspaceId="ws_default"
        policyVersion={2}
        authProfiles={authProfiles}
        isPolicyDirty={false}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /preview reasoning route/i })
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/router/resolve-preview");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      workspaceId: "ws_default",
      capability: "reasoning",
      policyVersion: 2
    });

    expect(await screen.findByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("openai")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.4")).toBeInTheDocument();
    expect(screen.getByText("OpenAI Primary")).toBeInTheDocument();
  });

  it("renders unresolved diagnostics returned by the preview api", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          workspaceId: "ws_default",
          capability: "coding",
          route: {
            capability: "coding",
            providerId: "openai",
            modelId: "gpt-5.4",
            authProfileId: null,
            policyVersion: 2,
            status: "missing_auth",
            reason: "no_active_auth_profile",
            resolvedAt: "2026-03-14T00:35:00.000Z"
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    render(
      <RoutePreviewPanel
        workspaceId="ws_default"
        policyVersion={2}
        authProfiles={authProfiles}
        isPolicyDirty={false}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /preview coding route/i })
    );

    expect(await screen.findByText("Missing auth")).toBeInTheDocument();
    expect(screen.getByText("No active auth profile")).toBeInTheDocument();
  });

  it("clears preview results when the saved policy version changes", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          workspaceId: "ws_default",
          capability: "reasoning",
          route: {
            capability: "reasoning",
            providerId: "openai",
            modelId: "gpt-5.4",
            authProfileId: "profile_openai_primary",
            policyVersion: 1,
            status: "resolved",
            reason: null,
            resolvedAt: "2026-03-14T00:30:00.000Z"
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    const view = render(
      <RoutePreviewPanel
        workspaceId="ws_default"
        policyVersion={1}
        authProfiles={authProfiles}
        isPolicyDirty={false}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /preview reasoning route/i })
    );

    expect(await screen.findByText("Resolved")).toBeInTheDocument();

    view.rerender(
      <RoutePreviewPanel
        workspaceId="ws_default"
        policyVersion={2}
        authProfiles={authProfiles}
        isPolicyDirty={false}
      />
    );

    expect(screen.queryByText("Resolved")).not.toBeInTheDocument();
    expect(screen.getAllByText("No preview yet.").length).toBeGreaterThan(0);
  });
});
