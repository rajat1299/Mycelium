import { describe, expect, it } from "vitest";
import {
  AuthProfileSchema,
  ProviderCatalogSchema,
  RoutePreviewRequestSchema,
  RoutePreviewResponseSchema,
  RouterPolicySchema,
  WorkspaceCredentialMetadataSchema
} from "./router";
import { RunStepSchema } from "./plan";

describe("router protocol contracts", () => {
  it("accepts provider catalog, credential metadata, auth profiles, and policy payloads", () => {
    const catalog = ProviderCatalogSchema.parse({
      providers: [
        {
          id: "anthropic",
          label: "Anthropic",
          authType: "api_key",
          supportsCapabilities: ["reasoning", "coding", "document"],
          supportsStreaming: true,
          supportsReasoning: true,
          supportsVision: true,
          docsUrl: "https://docs.anthropic.com"
        },
        {
          id: "openai",
          label: "OpenAI",
          authType: "api_key",
          supportsCapabilities: ["reasoning", "coding", "browser", "api"],
          supportsStreaming: true,
          supportsReasoning: true,
          supportsVision: true,
          docsUrl: "https://platform.openai.com/docs"
        }
      ],
      models: [
        {
          providerId: "anthropic",
          modelId: "claude-opus-4.6",
          label: "Claude Opus 4.6",
          capabilityFamilies: ["reasoning", "document"],
          contextWindow: 200000,
          costClass: "high",
          latencyClass: "medium",
          status: "active"
        },
        {
          providerId: "openai",
          modelId: "gpt-5.4",
          label: "GPT-5.4",
          capabilityFamilies: ["reasoning", "coding", "api"],
          contextWindow: 256000,
          costClass: "high",
          latencyClass: "medium",
          status: "active"
        }
      ]
    });

    const credential = WorkspaceCredentialMetadataSchema.parse({
      id: "cred_openai_primary",
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Primary",
      status: "active",
      createdAt: "2026-03-13T00:00:00.000Z",
      updatedAt: "2026-03-13T00:00:00.000Z",
      lastValidatedAt: "2026-03-13T00:00:00.000Z"
    });

    const authProfile = AuthProfileSchema.parse({
      id: "profile_openai_primary",
      workspaceId: "ws_default",
      providerId: "openai",
      label: "OpenAI Primary",
      credentialId: credential.id,
      status: "active",
      priority: 1,
      cooldownUntil: null,
      lastValidatedAt: "2026-03-13T00:00:00.000Z",
      createdAt: "2026-03-13T00:00:00.000Z",
      updatedAt: "2026-03-13T00:00:00.000Z"
    });

    const policy = RouterPolicySchema.parse({
      workspaceId: "ws_default",
      version: 3,
      updatedAt: "2026-03-13T00:00:00.000Z",
      candidates: [
        {
          capability: "reasoning",
          priority: 1,
          providerId: "anthropic",
          modelId: "claude-opus-4.6",
          authProfileId: null,
          enabled: true
        },
        {
          capability: "coding",
          priority: 1,
          providerId: "openai",
          modelId: "gpt-5.4",
          authProfileId: authProfile.id,
          enabled: true
        }
      ]
    });

    expect(catalog.providers).toHaveLength(2);
    expect(authProfile.credentialId).toBe("cred_openai_primary");
    expect(policy.candidates[1]?.authProfileId).toBe("profile_openai_primary");
  });

  it("accepts route preview payloads and persisted step route fields", () => {
    const request = RoutePreviewRequestSchema.parse({
      workspaceId: "ws_default",
      capability: "coding"
    });

    const response = RoutePreviewResponseSchema.parse({
      workspaceId: "ws_default",
      capability: "coding",
      route: {
        capability: "coding",
        providerId: "openai",
        modelId: "gpt-5.4",
        authProfileId: "profile_openai_primary",
        policyVersion: 3,
        status: "resolved",
        reason: null,
        resolvedAt: "2026-03-13T00:00:00.000Z"
      }
    });

    const step = RunStepSchema.parse({
      id: "step_run_123_plan_outcome_123:draft-brief",
      runId: "run_123",
      planNodeId: "plan_outcome_123:draft-brief",
      title: "Draft brief",
      kind: "task",
      capability: "coding",
      instruction: "Write the execution brief for the requested outcome.",
      template: "draft_brief",
      expectedArtifactPath: "artifacts/brief.md",
      expectedArtifactKind: "brief",
      routeProviderId: "openai",
      routeModelId: "gpt-5.4",
      routeAuthProfileId: "profile_openai_primary",
      routePolicyVersion: 3,
      routeStatus: "resolved",
      routeReason: null,
      routeResolvedAt: "2026-03-13T00:00:00.000Z",
      status: "ready",
      position: 1,
      createdAt: "2026-03-13T00:00:00.000Z",
      updatedAt: "2026-03-13T00:00:00.000Z"
    });

    expect(request.capability).toBe("coding");
    expect(response.route.status).toBe("resolved");
    expect(step).toEqual(
      expect.objectContaining({
        routeProviderId: "openai",
        routeModelId: "gpt-5.4",
        routeAuthProfileId: "profile_openai_primary",
        routePolicyVersion: 3,
        routeStatus: "resolved",
        routeReason: null,
        routeResolvedAt: "2026-03-13T00:00:00.000Z"
      })
    );
  });
});
