import { describe, expect, it } from "vitest";
import { AuthProfileSchema } from "@computer-oss/protocol";
import { buildApp } from "../src/app";
import { createInMemoryServiceContainer } from "../src/lib/service-container";

const TEST_ENCRYPTION_KEY = "12345678901234567890123456789012";

describe("auth profile routes", () => {
  it("creates and lists auth profiles", async () => {
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

    const createdResponse = await app.inject({
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

    expect(createdResponse.statusCode).toBe(201);
    const created = AuthProfileSchema.parse(createdResponse.json());
    expect(created.credentialId).toBe(credential.id);
    expect(created.status).toBe("active");

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/auth-profiles?workspaceId=ws_default"
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual({
      authProfiles: [AuthProfileSchema.parse(created)]
    });
  });

  it("returns a conflict when the selected credential no longer exists", async () => {
    const app = buildApp({
      services: createInMemoryServiceContainer({
        encryptionKey: TEST_ENCRYPTION_KEY
      })
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth-profiles",
      payload: {
        workspaceId: "ws_default",
        providerId: "openai",
        label: "OpenAI Primary",
        credentialId: "cred_missing",
        priority: 1
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "Credential cred_missing does not exist."
    });
  });
});
