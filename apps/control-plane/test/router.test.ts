import { describe, expect, it } from "vitest";
import {
  ProviderCatalogSchema,
  RoutePreviewResponseSchema,
  RouterPolicySchema
} from "@computer-oss/protocol";
import { buildApp } from "../src/app";
import { createInMemoryServiceContainer } from "../src/lib/service-container";

const TEST_ENCRYPTION_KEY = "12345678901234567890123456789012";

describe("router routes", () => {
  it("returns the static provider and model catalog", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/providers/models"
    });

    expect(response.statusCode).toBe(200);
    const catalog = ProviderCatalogSchema.parse(response.json());

    expect(catalog.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "openai"
        }),
        expect.objectContaining({
          id: "anthropic"
        })
      ])
    );
    expect(catalog.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: "openai",
          modelId: "gpt-5.4"
        })
      ])
    );
  });

  it("reads and writes router policy for a workspace", async () => {
    const app = buildApp();

    const putResponse = await app.inject({
      method: "PUT",
      url: "/api/router/policy",
      payload: {
        workspaceId: "ws_default",
        version: 1,
        updatedAt: "2026-03-14T00:00:00.000Z",
        candidates: [
          {
            capability: "coding",
            priority: 0,
            providerId: "openai",
            modelId: "gpt-5.4",
            authProfileId: null,
            enabled: true
          }
        ]
      }
    });

    expect(putResponse.statusCode).toBe(200);
    const stored = RouterPolicySchema.parse(putResponse.json());

    const getResponse = await app.inject({
      method: "GET",
      url: "/api/router/policy?workspaceId=ws_default"
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toEqual({
      policy: RouterPolicySchema.parse(stored)
    });
  });

  it("previews a resolved route when policy and auth are available", async () => {
    const app = buildApp({
      services: createInMemoryServiceContainer({
        encryptionKey: TEST_ENCRYPTION_KEY
      })
    });

    const credentialResponse = await app.inject({
      method: "POST",
      url: "/api/workspace-credentials",
      payload: {
        workspaceId: "ws_default",
        providerId: "openai",
        label: "OpenAI Primary",
        secret: "sk-test-openai-primary"
      }
    });
    const credential = credentialResponse.json();

    const profileResponse = await app.inject({
      method: "POST",
      url: "/api/auth-profiles",
      payload: {
        workspaceId: "ws_default",
        providerId: "openai",
        label: "OpenAI Primary",
        credentialId: credential.id,
        priority: 1
      }
    });
    const profile = profileResponse.json();

    await app.inject({
      method: "PUT",
      url: "/api/router/policy",
      payload: {
        workspaceId: "ws_default",
        version: 2,
        updatedAt: "2026-03-14T00:00:00.000Z",
        candidates: [
          {
            capability: "coding",
            priority: 0,
            providerId: "openai",
            modelId: "gpt-5.4",
            authProfileId: profile.id,
            enabled: true
          }
        ]
      }
    });

    const previewResponse = await app.inject({
      method: "POST",
      url: "/api/router/resolve-preview",
      payload: {
        workspaceId: "ws_default",
        capability: "coding"
      }
    });

    expect(previewResponse.statusCode).toBe(200);
    const preview = RoutePreviewResponseSchema.parse(previewResponse.json());
    expect(preview.route).toMatchObject({
      status: "resolved",
      reason: null,
      providerId: "openai",
      modelId: "gpt-5.4",
      authProfileId: profile.id,
      policyVersion: 2
    });
  });

  it("previews unresolved diagnostics when auth is missing", async () => {
    const app = buildApp();

    await app.inject({
      method: "PUT",
      url: "/api/router/policy",
      payload: {
        workspaceId: "ws_default",
        version: 3,
        updatedAt: "2026-03-14T00:00:00.000Z",
        candidates: [
          {
            capability: "coding",
            priority: 0,
            providerId: "openai",
            modelId: "gpt-5.4",
            authProfileId: null,
            enabled: true
          }
        ]
      }
    });

    const previewResponse = await app.inject({
      method: "POST",
      url: "/api/router/resolve-preview",
      payload: {
        workspaceId: "ws_default",
        capability: "coding"
      }
    });

    expect(previewResponse.statusCode).toBe(200);
    const preview = RoutePreviewResponseSchema.parse(previewResponse.json());
    expect(preview.route).toMatchObject({
      status: "missing_auth",
      reason: "no_active_auth_profile",
      providerId: "openai",
      modelId: "gpt-5.4",
      authProfileId: null,
      policyVersion: 3
    });
  });
});
