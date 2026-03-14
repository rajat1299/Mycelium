import { describe, expect, it } from "vitest";
import { AuthProfileRepository } from "./auth-profiles";
import { RouterPolicyRepository } from "./router-policy";
import { createRepositoryTestDatabase } from "./test-database";

describe("AuthProfileRepository", () => {
  it("creates auth profiles from workspace-scoped credentials and lists them by priority", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new AuthProfileRepository(db as never);

    state.workspaceCredentials.push(
      {
        id: "cred_openai_primary",
        workspaceId: "ws_default",
        providerId: "openai",
        label: "OpenAI Primary",
        secretCiphertext: "ciphertext_openai_primary",
        secretNonce: "nonce_openai_primary",
        secretVersion: 1,
        status: "active",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        updatedAt: new Date("2026-03-13T00:00:00.000Z"),
        lastValidatedAt: new Date("2026-03-13T00:00:00.000Z")
      },
      {
        id: "cred_openai_secondary",
        workspaceId: "ws_default",
        providerId: "openai",
        label: "OpenAI Secondary",
        secretCiphertext: "ciphertext_openai_secondary",
        secretNonce: "nonce_openai_secondary",
        secretVersion: 1,
        status: "active",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        updatedAt: new Date("2026-03-13T00:00:00.000Z"),
        lastValidatedAt: null
      }
    );

    await repository.create({
      id: "profile_openai_secondary",
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Secondary",
      credentialId: "cred_openai_secondary",
      status: "active",
      priority: 2,
      cooldownUntil: null,
      lastValidatedAt: null,
      createdAt: "2026-03-13T00:02:00.000Z",
      updatedAt: "2026-03-13T00:02:00.000Z"
    });

    const created = await repository.create({
      id: "profile_openai_primary",
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Primary",
      credentialId: "cred_openai_primary",
      status: "active",
      priority: 1,
      cooldownUntil: null,
      lastValidatedAt: "2026-03-13T00:00:00.000Z",
      createdAt: "2026-03-13T00:01:00.000Z",
      updatedAt: "2026-03-13T00:01:00.000Z"
    });

    expect(created).toEqual(
      expect.objectContaining({
        id: "profile_openai_primary",
        credentialId: "cred_openai_primary",
        priority: 1
      })
    );

    await expect(repository.listByWorkspace("ws_default")).resolves.toEqual([
      expect.objectContaining({
        id: "profile_openai_primary",
        priority: 1
      }),
      expect.objectContaining({
        id: "profile_openai_secondary",
        priority: 2
      })
    ]);
  });

  it("rejects auth profiles that reference credentials from another workspace or provider", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new AuthProfileRepository(db as never);

    state.workspaceCredentials.push(
      {
        id: "cred_openai_other_workspace",
        workspaceId: "ws_other",
        providerId: "openai",
        label: "Other Workspace",
        secretCiphertext: "ciphertext_other_workspace",
        secretNonce: "nonce_other_workspace",
        secretVersion: 1,
        status: "active",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        updatedAt: new Date("2026-03-13T00:00:00.000Z"),
        lastValidatedAt: null
      },
      {
        id: "cred_anthropic_primary",
        workspaceId: "ws_default",
        providerId: "anthropic",
        label: "Anthropic Primary",
        secretCiphertext: "ciphertext_anthropic_primary",
        secretNonce: "nonce_anthropic_primary",
        secretVersion: 1,
        status: "active",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        updatedAt: new Date("2026-03-13T00:00:00.000Z"),
        lastValidatedAt: null
      }
    );

    await expect(
      repository.create({
        id: "profile_openai_other_workspace",
        workspaceId: "ws_default",
        providerId: "openai",
        label: "Other Workspace",
        credentialId: "cred_openai_other_workspace",
        status: "active",
        priority: 1,
        cooldownUntil: null,
        lastValidatedAt: null,
        createdAt: "2026-03-13T00:01:00.000Z",
        updatedAt: "2026-03-13T00:01:00.000Z"
      })
    ).rejects.toThrow(
      "Credential cred_openai_other_workspace belongs to workspace ws_other, not ws_default."
    );

    await expect(
      repository.create({
        id: "profile_openai_provider_mismatch",
        workspaceId: "ws_default",
        providerId: "openai",
        label: "Provider Mismatch",
        credentialId: "cred_anthropic_primary",
        status: "active",
        priority: 1,
        cooldownUntil: null,
        lastValidatedAt: null,
        createdAt: "2026-03-13T00:02:00.000Z",
        updatedAt: "2026-03-13T00:02:00.000Z"
      })
    ).rejects.toThrow(
      "Credential cred_anthropic_primary belongs to provider anthropic, not openai."
    );
  });

  it("rejects deleting auth profiles that are still referenced by router policy candidates", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const profiles = new AuthProfileRepository(db as never);
    const policies = new RouterPolicyRepository(db as never);

    state.workspaceCredentials.push({
      id: "cred_openai_primary",
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Primary",
      secretCiphertext: "ciphertext_openai_primary",
      secretNonce: "nonce_openai_primary",
      secretVersion: 1,
      status: "active",
      createdAt: new Date("2026-03-13T00:00:00.000Z"),
      updatedAt: new Date("2026-03-13T00:00:00.000Z"),
      lastValidatedAt: null
    });

    await profiles.create({
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
    await policies.upsert({
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

    await expect(profiles.delete("profile_openai_primary")).rejects.toThrow(
      'update or delete on table "auth_profiles" violates foreign key constraint "router_policy_candidates_auth_profile_id_fkey" on table "router_policy_candidates"'
    );
  });
});
