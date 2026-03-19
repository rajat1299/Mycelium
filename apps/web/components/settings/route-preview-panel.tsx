"use client";

import { useEffect, useState } from "react";
import {
  RoutePreviewResponseSchema,
  type AuthProfile,
  type CapabilityFamily,
  type StepRoute
} from "@computer-oss/protocol";
import {
  formatCapabilityLabel,
  formatRouteReason,
  formatRouteStatus,
  resolveAuthProfileLabel,
  ROUTE_PREVIEW_CAPABILITIES,
  routeStatusVariant
} from "../../lib/routing";
import { Badge } from "../ui/badge";

type RoutePreviewPanelProps = {
  workspaceId: string;
  policyVersion: number | null;
  authProfiles: AuthProfile[];
  isPolicyDirty: boolean;
};

type PreviewState = {
  status: "idle" | "loading" | "loaded" | "error";
  route: StepRoute | null;
  message: string | null;
};

function readErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

function initialPreviewState(): PreviewState {
  return {
    status: "idle",
    route: null,
    message: null
  };
}

export function RoutePreviewPanel({
  workspaceId,
  policyVersion,
  authProfiles,
  isPolicyDirty
}: RoutePreviewPanelProps) {
  const [previews, setPreviews] = useState<
    Partial<Record<CapabilityFamily, PreviewState>>
  >({});

  useEffect(() => {
    setPreviews({});
  }, [policyVersion, workspaceId]);

  async function previewCapability(capability: CapabilityFamily) {
    setPreviews((current) => ({
      ...current,
      [capability]: {
        status: "loading",
        route: null,
        message: null
      }
    }));

    try {
      const response = await fetch("/api/router/resolve-preview", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          workspaceId,
          capability,
          ...(policyVersion !== null ? { policyVersion } : {})
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Failed to preview route."));
      }

      const parsed = RoutePreviewResponseSchema.parse(payload);

      setPreviews((current) => ({
        ...current,
        [capability]: {
          status: "loaded",
          route: parsed.route,
          message: null
        }
      }));
    } catch (error) {
      setPreviews((current) => ({
        ...current,
        [capability]: {
          status: "error",
          route: null,
          message:
            error instanceof Error ? error.message : "Failed to preview route."
        }
      }));
    }
  }

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Route preview
          </p>
          <h2 className="mt-2 font-serif text-xl tracking-tight text-ink">
            Preview deterministic routing
          </h2>
        </div>
        <Badge variant="slate">
          {policyVersion !== null ? `Policy v${policyVersion}` : "No saved policy"}
        </Badge>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted">
        Preview the saved policy for the most common execution capabilities before
        you start a run.
      </p>

      {isPolicyDirty ? (
        <div className="mt-4 rounded-[1.4rem] border border-amber-200/80 bg-amber-100/70 px-4 py-3 text-sm leading-6 text-amber-900">
          Save the policy to preview the latest routing decisions.
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {ROUTE_PREVIEW_CAPABILITIES.map((capability) => {
          const preview = previews[capability] ?? initialPreviewState();

          return (
            <div
              key={capability}
              className="rounded-[1.5rem] border border-panel-line bg-surface-elevated p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {formatCapabilityLabel(capability)}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    Saved policy preview
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => previewCapability(capability)}
                  disabled={isPolicyDirty || preview.status === "loading"}
                  className="rounded-full border border-panel-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={`Preview ${capability} route`}
                >
                  {preview.status === "loading" ? "Previewing" : "Preview route"}
                </button>
              </div>

              {preview.status === "idle" ? (
                <p className="mt-4 text-sm leading-6 text-muted">
                  No preview yet.
                </p>
              ) : null}

              {preview.status === "error" && preview.message ? (
                <p className="mt-4 text-sm leading-6 text-amber-900">
                  {preview.message}
                </p>
              ) : null}

              {preview.route ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {preview.route.providerId ? (
                      <Badge size="sm">{preview.route.providerId}</Badge>
                    ) : null}
                    {preview.route.modelId ? (
                      <Badge size="sm">{preview.route.modelId}</Badge>
                    ) : null}
                    {resolveAuthProfileLabel(authProfiles, preview.route.authProfileId) ? (
                      <Badge size="sm">
                        {
                          resolveAuthProfileLabel(
                            authProfiles,
                            preview.route.authProfileId
                          )!
                        }
                      </Badge>
                    ) : null}
                    <Badge
                      variant={routeStatusVariant(preview.route.status)}
                      size="sm"
                    >
                      {formatRouteStatus(preview.route.status)}
                    </Badge>
                  </div>
                  {preview.route.reason ? (
                    <p className="mt-3 text-sm leading-6 text-amber-900">
                      {formatRouteReason(preview.route.reason)}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {formatCapabilityLabel(capability)} resolves through the saved
                      provider, model, and auth profile.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
