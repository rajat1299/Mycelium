import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthProfile, ProviderCatalog } from "@computer-oss/protocol";
import { RouterPolicyEditor } from "./router-policy-editor";

const fetchMock = vi.fn();

const catalog: ProviderCatalog = {
  providers: [
    {
      id: "openai",
      label: "OpenAI",
      authType: "api_key" as const,
      supportsCapabilities: ["reasoning", "coding", "research", "document"],
      supportsStreaming: true,
      supportsReasoning: true,
      supportsVision: true,
      docsUrl: "https://platform.openai.com/docs"
    }
  ],
  models: [
    {
      providerId: "openai",
      modelId: "gpt-5.4",
      label: "GPT-5.4",
      capabilityFamilies: ["reasoning", "coding", "research", "document"],
      contextWindow: 400000,
      costClass: "high" as const,
      latencyClass: "medium" as const,
      status: "active" as const
    }
  ]
};

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

describe("RouterPolicyEditor", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("submits updated router policy candidates back through the settings api", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          workspaceId: "ws_default",
          version: 2,
          updatedAt: "2026-03-14T01:00:00.000Z",
          candidates: [
            {
              capability: "reasoning",
              priority: 0,
              providerId: "openai",
              modelId: "gpt-5.4",
              authProfileId: "profile_openai_primary",
              enabled: true
            },
            {
              capability: "coding",
              priority: 0,
              providerId: "openai",
              modelId: "gpt-5.4",
              authProfileId: "profile_openai_primary",
              enabled: true
            }
          ]
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
      <RouterPolicyEditor
        workspaceId="ws_default"
        catalog={catalog}
        policy={{
          workspaceId: "ws_default",
          version: 1,
          updatedAt: "2026-03-14T00:00:00.000Z",
          candidates: [
            {
              capability: "reasoning",
              priority: 0,
              providerId: "openai",
              modelId: "gpt-5.4",
              authProfileId: "profile_openai_primary",
              enabled: true
            }
          ]
        }}
        authProfiles={authProfiles}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /add coding candidate/i })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /save routing policy/i })
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/router/policy");
    expect(init.method).toBe("PUT");

    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      workspaceId: "ws_default",
      version: 2
    });
    expect(payload.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: "reasoning",
          priority: 0
        }),
        expect.objectContaining({
          capability: "coding",
          priority: 0,
          providerId: "openai",
          modelId: "gpt-5.4",
          authProfileId: "profile_openai_primary",
          enabled: true
        })
      ])
    );

    expect(await screen.findByText("Policy saved.")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
  });
});
