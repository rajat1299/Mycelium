import { describe, expect, it } from "vitest";
import type { AuthProfile, RouterPolicy } from "@computer-oss/protocol";
import { getProviderCatalog } from "./catalog";
import { resolveRoute } from "./resolve";

const resolvedAt = "2026-03-13T00:00:00.000Z";

describe("route resolution", () => {
  it("rejects policies from a different workspace", () => {
    const catalog = getProviderCatalog();
    const policy: RouterPolicy = {
      workspaceId: "ws_other",
      version: 7,
      updatedAt: resolvedAt,
      candidates: [
        {
          capability: "coding",
          priority: 1,
          providerId: "openai",
          modelId: "gpt-5.4",
          authProfileId: null,
          enabled: true
        }
      ]
    };

    expect(
      resolveRoute({
        workspaceId: "ws_default",
        capability: "coding",
        policy,
        catalog,
        authProfiles: [],
        resolvedAt
      })
    ).toEqual(
      expect.objectContaining({
        capability: "coding",
        status: "invalid_policy",
        reason: "policy_workspace_mismatch"
      })
    );
  });

  it("deterministically falls back to the next eligible candidate", () => {
    const catalog = getProviderCatalog();
    const policy: RouterPolicy = {
      workspaceId: "ws_default",
      version: 4,
      updatedAt: resolvedAt,
      candidates: [
        {
          capability: "coding",
          priority: 1,
          providerId: "openai",
          modelId: "gpt-5.4",
          authProfileId: "profile_openai_missing",
          enabled: true
        },
        {
          capability: "coding",
          priority: 2,
          providerId: "anthropic",
          modelId: "claude-opus-4.6",
          authProfileId: "profile_anthropic_primary",
          enabled: true
        }
      ]
    };
    const authProfiles: AuthProfile[] = [
      {
        id: "profile_anthropic_primary",
        workspaceId: "ws_default",
        providerId: "anthropic",
        label: "Anthropic Primary",
        credentialId: "cred_anthropic_primary",
        status: "active",
        priority: 1,
        cooldownUntil: null,
        lastValidatedAt: resolvedAt,
        createdAt: resolvedAt,
        updatedAt: resolvedAt
      }
    ];

    const route = resolveRoute({
      workspaceId: "ws_default",
      capability: "coding",
      policy,
      catalog,
      authProfiles,
      resolvedAt
    });

    expect(route).toEqual(
      expect.objectContaining({
        capability: "coding",
        providerId: "anthropic",
        modelId: "claude-opus-4.6",
        authProfileId: "profile_anthropic_primary",
        policyVersion: 4,
        status: "resolved",
        reason: null,
        resolvedAt
      })
    );
  });

  it("returns explicit unresolved diagnostics for invalid policy and missing auth", () => {
    const catalog = getProviderCatalog();
    const invalidProviderPolicy: RouterPolicy = {
      workspaceId: "ws_default",
      version: 4,
      updatedAt: resolvedAt,
      candidates: [
        {
          capability: "reasoning",
          priority: 1,
          providerId: "unknown-provider",
          modelId: "mystery-model",
          authProfileId: null,
          enabled: true
        }
      ]
    };
    const invalidPolicy: RouterPolicy = {
      workspaceId: "ws_default",
      version: 5,
      updatedAt: resolvedAt,
      candidates: [
        {
          capability: "reasoning",
          priority: 1,
          providerId: "openai",
          modelId: "gpt-unknown",
          authProfileId: null,
          enabled: true
        }
      ]
    };
    const missingExplicitProfilePolicy: RouterPolicy = {
      workspaceId: "ws_default",
      version: 5,
      updatedAt: resolvedAt,
      candidates: [
        {
          capability: "reasoning",
          priority: 1,
          providerId: "openai",
          modelId: "gpt-5.4",
          authProfileId: "profile_openai_missing",
          enabled: true
        }
      ]
    };
    const missingAuthPolicy: RouterPolicy = {
      workspaceId: "ws_default",
      version: 6,
      updatedAt: resolvedAt,
      candidates: [
        {
          capability: "reasoning",
          priority: 1,
          providerId: "openai",
          modelId: "gpt-5.4",
          authProfileId: null,
          enabled: true
        }
      ]
    };

    expect(
      resolveRoute({
        workspaceId: "ws_default",
        capability: "reasoning",
        policy: invalidProviderPolicy,
        catalog,
        authProfiles: [],
        resolvedAt
      })
    ).toEqual(
      expect.objectContaining({
        capability: "reasoning",
        status: "invalid_policy",
        reason: "provider_not_found"
      })
    );

    expect(
      resolveRoute({
        workspaceId: "ws_default",
        capability: "reasoning",
        policy: invalidPolicy,
        catalog,
        authProfiles: [],
        resolvedAt
      })
    ).toEqual(
      expect.objectContaining({
        capability: "reasoning",
        status: "invalid_policy",
        reason: "model_not_found"
      })
    );

    expect(
      resolveRoute({
        workspaceId: "ws_default",
        capability: "reasoning",
        policy: missingExplicitProfilePolicy,
        catalog,
        authProfiles: [],
        resolvedAt
      })
    ).toEqual(
      expect.objectContaining({
        capability: "reasoning",
        status: "invalid_policy",
        reason: "auth_profile_not_found"
      })
    );

    expect(
      resolveRoute({
        workspaceId: "ws_default",
        capability: "reasoning",
        policy: missingAuthPolicy,
        catalog,
        authProfiles: [],
        resolvedAt
      })
    ).toEqual(
      expect.objectContaining({
        capability: "reasoning",
        status: "missing_auth",
        reason: "no_active_auth_profile"
      })
    );
  });
});
