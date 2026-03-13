import {
  type CapabilityFamily,
  ModelDefinitionSchema,
  ProviderCatalogSchema,
  ProviderDefinitionSchema,
  type ModelDefinition,
  type ProviderCatalog,
  type ProviderDefinition
} from "@computer-oss/protocol";

const PROVIDERS = [
  {
    id: "anthropic",
    label: "Anthropic",
    authType: "api_key",
    supportsCapabilities: ["reasoning", "coding", "research", "document"],
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: true,
    docsUrl: "https://docs.anthropic.com"
  },
  {
    id: "openai",
    label: "OpenAI",
    authType: "api_key",
    supportsCapabilities: ["reasoning", "coding", "api", "terminal"],
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: true,
    docsUrl: "https://platform.openai.com/docs"
  },
  {
    id: "google",
    label: "Google",
    authType: "api_key",
    supportsCapabilities: ["reasoning", "research", "browser", "document"],
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: true,
    docsUrl: "https://ai.google.dev"
  },
  {
    id: "xai",
    label: "xAI",
    authType: "api_key",
    supportsCapabilities: ["fast_tasks", "fallback"],
    supportsStreaming: true,
    supportsReasoning: false,
    supportsVision: false,
    docsUrl: "https://docs.x.ai"
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    authType: "api_key",
    supportsCapabilities: ["reasoning", "coding", "research", "fallback"],
    supportsStreaming: true,
    supportsReasoning: true,
    supportsVision: true,
    docsUrl: "https://openrouter.ai/docs"
  }
] satisfies ProviderDefinition[];

const MODELS = [
  {
    providerId: "anthropic",
    modelId: "claude-opus-4.6",
    label: "Claude Opus 4.6",
    capabilityFamilies: ["reasoning", "coding", "research", "document"],
    contextWindow: 200000,
    costClass: "high",
    latencyClass: "medium",
    status: "active"
  },
  {
    providerId: "openai",
    modelId: "gpt-5.4",
    label: "GPT-5.4",
    capabilityFamilies: ["reasoning", "coding", "api", "terminal"],
    contextWindow: 256000,
    costClass: "high",
    latencyClass: "medium",
    status: "active"
  },
  {
    providerId: "google",
    modelId: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    capabilityFamilies: ["reasoning", "research", "browser", "document"],
    contextWindow: 1048576,
    costClass: "medium",
    latencyClass: "medium",
    status: "active"
  },
  {
    providerId: "xai",
    modelId: "grok-4-1-fast-non-reasoning",
    label: "Grok 4.1 Fast Non-Reasoning",
    capabilityFamilies: ["fast_tasks", "fallback"],
    contextWindow: 128000,
    costClass: "medium",
    latencyClass: "low",
    status: "active"
  },
  {
    providerId: "openrouter",
    modelId: "openrouter/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5 via OpenRouter",
    capabilityFamilies: ["reasoning", "coding", "research", "fallback"],
    contextWindow: 200000,
    costClass: "medium",
    latencyClass: "medium",
    status: "preview"
  }
] satisfies ModelDefinition[];

const STATIC_CATALOG = ProviderCatalogSchema.parse({
  providers: PROVIDERS.map((provider) => ProviderDefinitionSchema.parse(provider)),
  models: MODELS.map((model) => ModelDefinitionSchema.parse(model))
});

export function getProviderCatalog(): ProviderCatalog {
  return STATIC_CATALOG;
}

export function getProviderDefinition(
  catalog: ProviderCatalog,
  providerId: string
): ProviderDefinition | undefined {
  return catalog.providers.find((provider) => provider.id === providerId);
}

export function getModelDefinition(
  catalog: ProviderCatalog,
  providerId: string,
  modelId: string
): ModelDefinition | undefined {
  return catalog.models.find(
    (model) => model.providerId === providerId && model.modelId === modelId
  );
}

export function modelSupportsCapability(
  model: ModelDefinition | undefined,
  capability: CapabilityFamily
): boolean {
  return model?.capabilityFamilies.includes(capability) ?? false;
}
