import { describe, expect, it } from "vitest";
import { RouterPolicyRepository } from "./router-policy";
import { createRepositoryTestDatabase } from "./test-database";

describe("RouterPolicyRepository", () => {
  it("persists router policy candidates in priority order", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new RouterPolicyRepository(db as never);

    state.authProfiles.push({
      id: "profile_openai_primary",
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Primary",
      credentialId: "cred_openai_primary",
      status: "active",
      priority: 1,
      cooldownUntil: null,
      lastValidatedAt: null,
      createdAt: new Date("2026-03-13T00:00:00.000Z"),
      updatedAt: new Date("2026-03-13T00:00:00.000Z")
    });

    const stored = await repository.upsert({
      workspaceId: "ws_default",
      version: 4,
      updatedAt: "2026-03-13T00:10:00.000Z",
      candidates: [
        {
          capability: "coding",
          priority: 2,
          providerId: "openai",
          modelId: "gpt-5.4",
          authProfileId: "profile_openai_primary",
          enabled: true
        },
        {
          capability: "coding",
          priority: 1,
          providerId: "anthropic",
          modelId: "claude-opus-4.6",
          authProfileId: null,
          enabled: true
        }
      ]
    });

    expect(stored).toEqual({
      workspaceId: "ws_default",
      version: 4,
      updatedAt: "2026-03-13T00:10:00.000Z",
      candidates: [
        {
          capability: "coding",
          priority: 1,
          providerId: "anthropic",
          modelId: "claude-opus-4.6",
          authProfileId: null,
          enabled: true
        },
        {
          capability: "coding",
          priority: 2,
          providerId: "openai",
          modelId: "gpt-5.4",
          authProfileId: "profile_openai_primary",
          enabled: true
        }
      ]
    });

    expect(state.routerPolicies).toEqual([
      expect.objectContaining({
        workspaceId: "ws_default",
        version: 4
      })
    ]);
    expect(state.routerPolicyCandidates).toEqual([
      expect.objectContaining({
        workspaceId: "ws_default",
        capability: "coding",
        priority: 2,
        providerId: "openai",
        modelId: "gpt-5.4",
        authProfileId: "profile_openai_primary",
        enabled: true
      }),
      expect.objectContaining({
        workspaceId: "ws_default",
        capability: "coding",
        priority: 1,
        providerId: "anthropic",
        modelId: "claude-opus-4.6",
        authProfileId: null,
        enabled: true
      })
    ]);

    await expect(repository.getByWorkspace("ws_default")).resolves.toEqual(stored);
  });

  it("rejects candidates that reference auth profiles from another workspace or provider", async () => {
    const { db, state } = createRepositoryTestDatabase();
    const repository = new RouterPolicyRepository(db as never);

    state.authProfiles.push(
      {
        id: "profile_openai_other_workspace",
        workspaceId: "ws_other",
        providerId: "openai",
        label: "Other Workspace",
        credentialId: "cred_openai_other_workspace",
        status: "active",
        priority: 1,
        cooldownUntil: null,
        lastValidatedAt: null,
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        updatedAt: new Date("2026-03-13T00:00:00.000Z")
      },
      {
        id: "profile_anthropic_primary",
        workspaceId: "ws_default",
        providerId: "anthropic",
        label: "Anthropic Primary",
        credentialId: "cred_anthropic_primary",
        status: "active",
        priority: 1,
        cooldownUntil: null,
        lastValidatedAt: null,
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        updatedAt: new Date("2026-03-13T00:00:00.000Z")
      }
    );

    await expect(
      repository.upsert({
        workspaceId: "ws_default",
        version: 1,
        updatedAt: "2026-03-13T00:10:00.000Z",
        candidates: [
          {
            capability: "coding",
            priority: 1,
            providerId: "openai",
            modelId: "gpt-5.4",
            authProfileId: "profile_openai_other_workspace",
            enabled: true
          }
        ]
      })
    ).rejects.toThrow(
      "Auth profile profile_openai_other_workspace belongs to workspace ws_other, not ws_default."
    );

    await expect(
      repository.upsert({
        workspaceId: "ws_default",
        version: 2,
        updatedAt: "2026-03-13T00:11:00.000Z",
        candidates: [
          {
            capability: "coding",
            priority: 1,
            providerId: "openai",
            modelId: "gpt-5.4",
            authProfileId: "profile_anthropic_primary",
            enabled: true
          }
        ]
      })
    ).rejects.toThrow(
      "Auth profile profile_anthropic_primary belongs to provider anthropic, not openai."
    );
  });
});
