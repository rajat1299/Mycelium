import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AuthProfile,
  ProviderCatalog,
  WorkspaceCredentialMetadata
} from "@computer-oss/protocol";
import { AuthProfilesPanel } from "./auth-profiles-panel";

const fetchMock = vi.fn();

const catalog: ProviderCatalog = {
  providers: [
    {
      id: "openai",
      label: "OpenAI",
      authType: "api_key",
      supportsCapabilities: ["reasoning", "coding", "research", "document"],
      supportsStreaming: true,
      supportsReasoning: true,
      supportsVision: true,
      docsUrl: "https://platform.openai.com/docs"
    }
  ],
  models: []
};

const credentials: WorkspaceCredentialMetadata[] = [
  {
    id: "cred_openai_primary",
    workspaceId: "ws_default",
    providerId: "openai",
    label: "OpenAI Primary",
    status: "active",
    createdAt: "2026-03-14T00:00:00.000Z",
    updatedAt: "2026-03-14T00:00:00.000Z",
    lastValidatedAt: null
  }
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuthProfilesPanel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("creates an auth profile against the selected credential", async () => {
    const onAuthProfileCreated = vi.fn();

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "profile_openai_primary",
          workspaceId: "ws_default",
          providerId: "openai",
          label: "OpenAI Primary",
          credentialId: "cred_openai_primary",
          status: "active",
          priority: 1,
          cooldownUntil: null,
          lastValidatedAt: null,
          createdAt: "2026-03-14T00:00:00.000Z",
          updatedAt: "2026-03-14T00:00:00.000Z"
        } satisfies AuthProfile),
        {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    render(
      <AuthProfilesPanel
        workspaceId="ws_default"
        catalog={catalog}
        credentials={credentials}
        authProfiles={[]}
        onAuthProfileCreated={onAuthProfileCreated}
      />
    );

    fireEvent.change(screen.getByLabelText(/auth profile label/i), {
      target: { value: "OpenAI Primary" }
    });
    fireEvent.click(screen.getByRole("button", { name: /create auth profile/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth-profiles");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Primary",
      credentialId: "cred_openai_primary",
      priority: 1
    });

    expect(onAuthProfileCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "profile_openai_primary",
        label: "OpenAI Primary"
      })
    );
    expect(await screen.findByText("Auth profile created.")).toBeInTheDocument();
  });
});
