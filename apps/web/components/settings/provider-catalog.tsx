import type { ProviderCatalog } from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type ProviderCatalogProps = {
  catalog: ProviderCatalog;
};

export function ProviderCatalog({ catalog }: ProviderCatalogProps) {
  const modelsByProvider = new Map<string, ProviderCatalog["models"]>();

  for (const model of catalog.models) {
    const current = modelsByProvider.get(model.providerId) ?? [];
    current.push(model);
    modelsByProvider.set(model.providerId, current);
  }

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Provider catalog
          </p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight text-ink">
            Available providers
          </h2>
        </div>
        <Badge variant="slate">{catalog.providers.length} providers</Badge>
      </div>

      {catalog.providers.length === 0 ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-panel-line bg-white/60 p-6 text-sm leading-6 text-muted">
          No provider catalog is available from the control plane.
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {catalog.providers.map((provider) => {
            const models = modelsByProvider.get(provider.id) ?? [];

            return (
              <li
                key={provider.id}
                className="rounded-[1.5rem] border border-panel-line bg-white/75 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{provider.label}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">
                      {provider.id}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="slate" size="sm">
                      {models.length} models
                    </Badge>
                    <Badge variant="slate" size="sm">
                      {provider.authType}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {models.map((model) => (
                    <Badge key={model.modelId} size="sm">
                      {model.modelId}
                    </Badge>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
