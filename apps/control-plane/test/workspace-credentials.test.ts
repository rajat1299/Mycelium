import { describe, expect, it } from "vitest";
import { WorkspaceCredentialMetadataSchema } from "@computer-oss/protocol";
import { buildApp } from "../src/app";
import { createInMemoryServiceContainer } from "../src/lib/service-container";

const TEST_ENCRYPTION_KEY = "12345678901234567890123456789012";

describe("workspace credential routes", () => {
  it("creates and lists workspace credentials without returning plaintext secrets", async () => {
    const app = buildApp({
      services: createInMemoryServiceContainer({
        encryptionKey: TEST_ENCRYPTION_KEY
      })
    });

    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/workspace-credentials",
      payload: {
        workspaceId: "ws_default",
        providerId: "openai",
        label: "OpenAI Primary",
        secret: "sk-test-openai-primary"
      }
    });

    expect(createdResponse.statusCode).toBe(201);
    const created = WorkspaceCredentialMetadataSchema.parse(createdResponse.json());
    expect(created.providerId).toBe("openai");
    expect(createdResponse.json()).not.toHaveProperty("secret");
    expect(createdResponse.json()).not.toHaveProperty("secretCiphertext");
    expect(createdResponse.json()).not.toHaveProperty("secretNonce");

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/workspace-credentials?workspaceId=ws_default"
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual({
      credentials: [WorkspaceCredentialMetadataSchema.parse(created)]
    });
    expect(listResponse.json().credentials[0]).not.toHaveProperty("secret");
    expect(listResponse.json().credentials[0]).not.toHaveProperty("secretCiphertext");
  });

  it("rejects credential writes when MYCELIUM_ENCRYPTION_KEY is missing", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/workspace-credentials",
      payload: {
        workspaceId: "ws_default",
        providerId: "openai",
        label: "OpenAI Primary",
        secret: "sk-test-openai-primary"
      }
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: "MYCELIUM_ENCRYPTION_KEY is required for credential writes."
    });
  });
});
