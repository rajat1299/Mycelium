import { describe, expect, it } from "vitest";
import { ProviderCatalogSchema } from "@computer-oss/protocol";
import { buildApp } from "../src/app";

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
});
