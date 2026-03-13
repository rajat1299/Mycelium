import { describe, expect, it } from "vitest";
import type { AuthProfile, RouterPolicy } from "@computer-oss/protocol";
import { getProviderCatalog } from "./catalog";
import { listOrderedCandidates, validateRouterPolicy } from "./policy";

const authProfiles: AuthProfile[] = [
  {
    id: "profile_openai_primary",
    workspaceId: "ws_default",
    providerId: "openai",
    label: "OpenAI Primary",
    credentialId: "cred_openai_primary",
    status: "active",
    priority: 1,
    cooldownUntil: null,
    lastValidatedAt: "2026-03-13T00:00:00.000Z",
    createdAt: "2026-03-13T00:00:00.000Z",
    updatedAt: "2026-03-13T00:00:00.000Z"
  }
];

describe("router policy helpers", () => {
  it("orders candidates by priority for a capability", () => {
    const policy: RouterPolicy = {
      workspaceId: "ws_default",
      version: 2,
      updatedAt: "2026-03-13T00:00:00.000Z",
      candidates: [
        {
          capability: "coding",
          priority: 20,
          providerId: "anthropic",
          modelId: "claude-opus-4.6",
          authProfileId: null,
          enabled: true
        },
        {
          capability: "coding",
          priority: 10,
          providerId: "openai",
          modelId: "gpt-5.4",
          authProfileId: "profile_openai_primary",
          enabled: true
        }
      ]
    };

    expect(
      listOrderedCandidates(policy, "coding").map((candidate) => candidate.providerId)
    ).toEqual(["openai", "anthropic"]);
  });

  it("reports invalid references and provider mismatches", () => {
    const catalog = getProviderCatalog();
    const policy: RouterPolicy = {
      workspaceId: "ws_default",
      version: 2,
      updatedAt: "2026-03-13T00:00:00.000Z",
      candidates: [
        {
          capability: "browser",
          priority: 1,
          providerId: "openai",
          modelId: "gpt-5.4",
          authProfileId: "profile_openai_primary",
          enabled: true
        },
        {
          capability: "coding",
          priority: 2,
          providerId: "anthropic",
          modelId: "claude-opus-4.6",
          authProfileId: "profile_openai_primary",
          enabled: true
        }
      ]
    };

    const validation = validateRouterPolicy({
      catalog,
      policy,
      authProfiles
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "capability_unsupported",
          providerId: "openai",
          modelId: "gpt-5.4"
        }),
        expect.objectContaining({
          code: "auth_profile_provider_mismatch",
          authProfileId: "profile_openai_primary",
          providerId: "anthropic"
        })
      ])
    );
  });
});
