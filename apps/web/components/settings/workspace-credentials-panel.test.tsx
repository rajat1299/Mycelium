import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderCatalog } from "@computer-oss/protocol";
import { WorkspaceCredentialsPanel } from "./workspace-credentials-panel";

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WorkspaceCredentialsPanel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("creates a credential without rendering the plaintext secret again", async () => {
    const onCredentialCreated = vi.fn();

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "cred_openai_primary",
          workspaceId: "ws_default",
          providerId: "openai",
          label: "OpenAI Primary",
          status: "active",
          createdAt: "2026-03-14T00:00:00.000Z",
          updatedAt: "2026-03-14T00:00:00.000Z",
          lastValidatedAt: null
        }),
        {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    render(
      <WorkspaceCredentialsPanel
        workspaceId="ws_default"
        catalog={catalog}
        credentials={[]}
        onCredentialCreated={onCredentialCreated}
      />
    );

    fireEvent.change(screen.getByLabelText(/credential label/i), {
      target: { value: "OpenAI Primary" }
    });
    fireEvent.change(screen.getByLabelText(/credential secret/i), {
      target: { value: "sk-openai-primary" }
    });
    fireEvent.click(screen.getByRole("button", { name: /add credential/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/workspace-credentials");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Primary",
      secret: "sk-openai-primary"
    });

    expect(onCredentialCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cred_openai_primary",
        label: "OpenAI Primary"
      })
    );
    expect(
      await screen.findByText(/plaintext secret is no longer shown/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/credential secret/i)).toHaveValue("");
  });
});
