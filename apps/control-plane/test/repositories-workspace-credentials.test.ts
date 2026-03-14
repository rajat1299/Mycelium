import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "../src/lib/repositories";

describe("in-memory workspace credential repositories", () => {
  it("stores encrypted credentials and lists only metadata", async () => {
    const repositories = createInMemoryRepositories();

    const created = await repositories.workspaceCredentials.create({
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

    expect(created).toEqual(
      expect.objectContaining({
        id: "cred_openai_primary",
        workspaceId: "ws_default",
        providerId: "openai",
        label: "OpenAI Primary",
        status: "active"
      })
    );
    expect(created).not.toHaveProperty("secretCiphertext");
    expect(created).not.toHaveProperty("secretNonce");
    expect(created).not.toHaveProperty("secretVersion");

    await expect(
      repositories.workspaceCredentials.listByWorkspace("ws_default")
    ).resolves.toEqual([
      expect.objectContaining({
        id: "cred_openai_primary",
        providerId: "openai",
        status: "active"
      })
    ]);
  });

  it("rejects deleting credentials that are still referenced by auth profiles", async () => {
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

    await expect(
      repositories.workspaceCredentials.delete("cred_openai_primary")
    ).rejects.toThrow(
      'update or delete on table "workspace_credentials" violates foreign key constraint "auth_profiles_credential_id_fkey" on table "auth_profiles"'
    );
  });
});
