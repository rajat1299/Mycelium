import { describe, expect, it } from "vitest";
import {
  getProviderCatalog,
  getProviderDefinition,
  getModelDefinition,
  modelSupportsCapability
} from "./catalog";

describe("router catalog", () => {
  it("exposes a static provider and model registry", () => {
    const catalog = getProviderCatalog();

    expect(catalog.providers.map((provider) => provider.id)).toEqual(
      expect.arrayContaining(["anthropic", "openai", "google", "xai", "openrouter"])
    );
    expect(getProviderDefinition(catalog, "openai")).toEqual(
      expect.objectContaining({
        id: "openai",
        supportsStreaming: true
      })
    );
    expect(getModelDefinition(catalog, "openai", "gpt-5.4")).toEqual(
      expect.objectContaining({
        providerId: "openai",
        modelId: "gpt-5.4"
      })
    );
  });

  it("checks capability-family compatibility deterministically", () => {
    const catalog = getProviderCatalog();
    const codingModel = getModelDefinition(catalog, "openai", "gpt-5.4");
    const researchModel = getModelDefinition(catalog, "google", "gemini-2.5-pro");

    expect(modelSupportsCapability(codingModel, "coding")).toBe(true);
    expect(modelSupportsCapability(codingModel, "browser")).toBe(false);
    expect(modelSupportsCapability(researchModel, "research")).toBe(true);
  });
});
