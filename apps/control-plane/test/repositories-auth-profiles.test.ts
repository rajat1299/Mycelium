import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "../src/lib/repositories";

describe("in-memory auth profile repositories", () => {
  it("creates workspace-scoped auth profiles from stored credentials", async () => {
    const repositories = createInMemoryRepositories();

    await repositories.workspaceCredentials.create({
      id: "cred_openai_primary",
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Primary",
      secretCiphertext: "ciphertext_openai_primary",
      secretNonce: "nonce_openai_primary",
      secretVersion: 1,
      status: "active",
      createdAt: "2026-03-13T00:00:00.000Z",
      updatedAt: "2026-03-13T00:00:00.000Z",
      lastValidatedAt: null
    });

    const created = await repositories.authProfiles.create({
      id: "profile_openai_primary",
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Primary",
      credentialId: "cred_openai_primary",
      status: "active",
      priority: 1,
      cooldownUntil: null,
      lastValidatedAt: null,
      createdAt: "2026-03-13T00:01:00.000Z",
      updatedAt: "2026-03-13T00:01:00.000Z"
    });

    expect(created).toEqual(
      expect.objectContaining({
        id: "profile_openai_primary",
        credentialId: "cred_openai_primary",
        providerId: "openai"
      })
    );

    await expect(repositories.authProfiles.listByWorkspace("ws_default")).resolves.toEqual([
      expect.objectContaining({
        id: "profile_openai_primary",
        priority: 1
      })
    ]);
  });

  it("rejects auth profiles when the credential belongs to another provider", async () => {
    const repositories = createInMemoryRepositories();

    await repositories.workspaceCredentials.create({
      id: "cred_anthropic_primary",
      workspaceId: "ws_default",
      providerId: "anthropic",
      label: "Anthropic Primary",
      secretCiphertext: "ciphertext_anthropic_primary",
      secretNonce: "nonce_anthropic_primary",
      secretVersion: 1,
      status: "active",
      createdAt: "2026-03-13T00:00:00.000Z",
      updatedAt: "2026-03-13T00:00:00.000Z",
      lastValidatedAt: null
    });

    await expect(
      repositories.authProfiles.create({
        id: "profile_openai_primary",
        workspaceId: "ws_default",
        providerId: "openai",
        label: "OpenAI Primary",
        credentialId: "cred_anthropic_primary",
        status: "active",
        priority: 1,
        cooldownUntil: null,
        lastValidatedAt: null,
        createdAt: "2026-03-13T00:01:00.000Z",
        updatedAt: "2026-03-13T00:01:00.000Z"
      })
    ).rejects.toThrow(
      "Credential cred_anthropic_primary belongs to provider anthropic, not openai."
    );
  });

  it("rejects deleting auth profiles that are still referenced by router policy candidates", async () => {
    const repositories = createInMemoryRepositories();

    await repositories.workspaceCredentials.create({
      id: "cred_openai_primary",
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Primary",
      secretCiphertext: "ciphertext_openai_primary",
      secretNonce: "nonce_openai_primary",
      secretVersion: 1,
      status: "active",
      createdAt: "2026-03-13T00:00:00.000Z",
      updatedAt: "2026-03-13T00:00:00.000Z",
      lastValidatedAt: null
    });
    await repositories.authProfiles.create({
      id: "profile_openai_primary",
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Primary",
      credentialId: "cred_openai_primary",
      status: "active",
      priority: 1,
      cooldownUntil: null,
      lastValidatedAt: null,
      createdAt: "2026-03-13T00:01:00.000Z",
      updatedAt: "2026-03-13T00:01:00.000Z"
    });
    await repositories.routerPolicy.upsert({
      workspaceId: "ws_default",
      version: 1,
      updatedAt: "2026-03-13T00:02:00.000Z",
      candidates: [
        {
          capability: "coding",
          priority: 1,
          providerId: "openai",
          modelId: "gpt-5.4",
          authProfileId: "profile_openai_primary",
          enabled: true
        }
      ]
    });

    await expect(
      repositories.authProfiles.delete("profile_openai_primary")
    ).rejects.toThrow(
      'update or delete on table "auth_profiles" violates foreign key constraint "router_policy_candidates_auth_profile_id_fkey" on table "router_policy_candidates"'
    );
  });
});
