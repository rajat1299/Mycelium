import { describe, expect, it } from "vitest";
import { AuthProfileRepository } from "./auth-profiles";
import { WorkspaceCredentialRepository } from "./workspace-credentials";
import { createRepositoryTestDatabase } from "./test-database";

describe("WorkspaceCredentialRepository", () => {
  it("creates encrypted credential records and lists metadata without secret fields", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new WorkspaceCredentialRepository(db as never);

    const created = await repository.create({
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

    expect(created).toEqual({
      id: "cred_openai_primary",
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Primary",
      status: "active",
      createdAt: "2026-03-13T00:00:00.000Z",
      updatedAt: "2026-03-13T00:00:00.000Z",
      lastValidatedAt: null
    });
    expect(created).not.toHaveProperty("secretCiphertext");
    expect(created).not.toHaveProperty("secretNonce");
    expect(created).not.toHaveProperty("secretVersion");

    expect(state.workspaceCredentials).toEqual([
      expect.objectContaining({
        id: "cred_openai_primary",
        workspaceId: "ws_default",
        providerId: "openai",
        label: "OpenAI Primary",
        secretCiphertext: "ciphertext_openai_primary",
        secretNonce: "nonce_openai_primary",
        secretVersion: 1,
        status: "active"
      })
    ]);

    await expect(repository.listByWorkspace("ws_default")).resolves.toEqual([
      {
        id: "cred_openai_primary",
        workspaceId: "ws_default",
        providerId: "openai",
        label: "OpenAI Primary",
        status: "active",
        createdAt: "2026-03-13T00:00:00.000Z",
        updatedAt: "2026-03-13T00:00:00.000Z",
        lastValidatedAt: null
      }
    ]);
  });

  it("rejects deleting credentials that are still referenced by auth profiles", async () => {
    const { db } = createRepositoryTestDatabase();
    const credentials = new WorkspaceCredentialRepository(db as never);
    const profiles = new AuthProfileRepository(db as never);

    await credentials.create({
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

    await expect(credentials.delete("cred_openai_primary")).rejects.toThrow(
      'update or delete on table "workspace_credentials" violates foreign key constraint "auth_profiles_credential_id_fkey" on table "auth_profiles"'
    );
  });
});
