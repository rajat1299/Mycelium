import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

const mocks = vi.hoisted(() => ({
  getDefaultWorkspaceId: vi.fn(),
  getProviderCatalog: vi.fn(),
  listWorkspaceCredentials: vi.fn(),
  listAuthProfiles: vi.fn(),
  getRouterPolicy: vi.fn()
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>
}));

vi.mock("../../lib/api", () => ({
  getDefaultWorkspaceId: mocks.getDefaultWorkspaceId,
  getProviderCatalog: mocks.getProviderCatalog,
  listWorkspaceCredentials: mocks.listWorkspaceCredentials,
  listAuthProfiles: mocks.listAuthProfiles,
  getRouterPolicy: mocks.getRouterPolicy
}));

afterEach(() => {
  cleanup();
});

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getDefaultWorkspaceId.mockReturnValue("ws_default");
    mocks.getProviderCatalog.mockResolvedValue({
      providers: [
        {
          id: "anthropic",
          label: "Anthropic",
          authType: "api_key",
          supportsCapabilities: ["reasoning", "coding", "research", "document"],
          supportsStreaming: true,
          supportsReasoning: true,
          supportsVision: true,
          docsUrl: "https://docs.anthropic.com"
        }
      ],
      models: [
        {
          providerId: "anthropic",
          modelId: "claude-opus-4.6",
          label: "Claude Opus 4.6",
          capabilityFamilies: ["reasoning", "coding", "research", "document"],
          contextWindow: 200000,
          costClass: "high",
          latencyClass: "medium",
          status: "active"
        }
      ]
    });
    mocks.listWorkspaceCredentials.mockResolvedValue([
      {
        id: "cred_anthropic_primary",
        workspaceId: "ws_default",
        providerId: "anthropic",
        label: "Anthropic Primary",
        status: "active",
        createdAt: "2026-03-14T00:00:00.000Z",
        updatedAt: "2026-03-14T00:00:00.000Z",
        lastValidatedAt: "2026-03-14T00:05:00.000Z"
      }
    ]);
    mocks.listAuthProfiles.mockResolvedValue([
      {
        id: "profile_anthropic_primary",
        workspaceId: "ws_default",
        providerId: "anthropic",
        label: "Anthropic Primary",
        credentialId: "cred_anthropic_primary",
        status: "active",
        priority: 1,
        cooldownUntil: null,
        lastValidatedAt: "2026-03-14T00:05:00.000Z",
        createdAt: "2026-03-14T00:00:00.000Z",
        updatedAt: "2026-03-14T00:00:00.000Z"
      }
    ]);
    mocks.getRouterPolicy.mockResolvedValue({
      workspaceId: "ws_default",
      version: 1,
      updatedAt: "2026-03-14T00:10:00.000Z",
      candidates: [
        {
          capability: "reasoning",
          priority: 0,
          providerId: "anthropic",
          modelId: "claude-opus-4.6",
          authProfileId: "profile_anthropic_primary",
          enabled: true
        }
      ]
    });
  });

  it("loads the provider catalog, credentials, auth profiles, and router policy for the default workspace", async () => {
    render(await SettingsPage());

    expect(mocks.getDefaultWorkspaceId).toHaveBeenCalled();
    expect(mocks.listWorkspaceCredentials).toHaveBeenCalledWith("ws_default");
    expect(mocks.listAuthProfiles).toHaveBeenCalledWith("ws_default");
    expect(mocks.getRouterPolicy).toHaveBeenCalledWith("ws_default");

    expect(
      screen.getByRole("heading", { name: /provider routing and byo keys/i })
    ).toBeInTheDocument();
    expect(screen.getByText("ws_default")).toBeInTheDocument();
    expect(screen.getAllByText("Anthropic").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Anthropic Primary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("claude-opus-4.6").length).toBeGreaterThan(0);
  });
});
