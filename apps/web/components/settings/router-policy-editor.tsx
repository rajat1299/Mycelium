"use client";

import { useEffect, useState } from "react";
import type {
  AuthProfile,
  CapabilityFamily,
  ProviderCatalog,
  RouterPolicy,
  RouterPolicyCandidate
} from "@computer-oss/protocol";
import { RouterPolicySchema } from "@computer-oss/protocol";
import {
  CAPABILITY_OPTIONS,
  formatCapabilityLabel,
  resolveAuthProfileLabel
} from "../../lib/routing";
import { RoutePreviewPanel } from "./route-preview-panel";
import { Badge } from "../ui/badge";

type RouterPolicyEditorProps = {
  workspaceId: string;
  catalog: ProviderCatalog;
  policy: RouterPolicy | null;
  authProfiles: AuthProfile[];
};

type SaveState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string | null;
};

function buildEmptyPolicy(workspaceId: string): RouterPolicy {
  return {
    workspaceId,
    version: 0,
    updatedAt: new Date(0).toISOString(),
    candidates: []
  };
}

function capabilityOrder(capability: CapabilityFamily) {
  return CAPABILITY_OPTIONS.indexOf(capability);
}

function compareCandidates(
  left: RouterPolicyCandidate,
  right: RouterPolicyCandidate
) {
  if (left.capability !== right.capability) {
    return capabilityOrder(left.capability) - capabilityOrder(right.capability);
  }

  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  return `${left.providerId}:${left.modelId}:${left.authProfileId ?? ""}`.localeCompare(
    `${right.providerId}:${right.modelId}:${right.authProfileId ?? ""}`
  );
}

function normalizeCandidates(candidates: RouterPolicyCandidate[]) {
  const normalized: RouterPolicyCandidate[] = [];

  for (const capability of CAPABILITY_OPTIONS) {
    const ordered = candidates
      .filter((candidate) => candidate.capability === capability)
      .sort(compareCandidates);

    ordered.forEach((candidate, index) => {
      normalized.push({
        ...candidate,
        priority: index
      });
    });
  }

  return normalized;
}

function normalizePolicy(policy: RouterPolicy) {
  return {
    ...policy,
    candidates: normalizeCandidates(policy.candidates)
  };
}

function createInitialPolicy(workspaceId: string, policy: RouterPolicy | null) {
  return normalizePolicy(policy ?? buildEmptyPolicy(workspaceId));
}

function listModelsForCapability(
  catalog: ProviderCatalog,
  capability: CapabilityFamily,
  providerId: string
) {
  return catalog.models
    .filter(
      (model) =>
        model.providerId === providerId &&
        model.capabilityFamilies.includes(capability)
    )
    .sort((left, right) => left.modelId.localeCompare(right.modelId));
}

function listProvidersForCapability(
  catalog: ProviderCatalog,
  capability: CapabilityFamily
) {
  return catalog.providers
    .filter((provider) =>
      catalog.models.some(
        (model) =>
          model.providerId === provider.id &&
          model.capabilityFamilies.includes(capability)
      )
    )
    .sort((left, right) => left.label.localeCompare(right.label));
}

function listProfilesForProvider(
  authProfiles: AuthProfile[],
  providerId: string
) {
  return [...authProfiles]
    .filter((profile) => profile.providerId === providerId)
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      return left.label.localeCompare(right.label);
    });
}

function buildDefaultCandidate(
  capability: CapabilityFamily,
  catalog: ProviderCatalog,
  authProfiles: AuthProfile[]
) {
  const provider = listProvidersForCapability(catalog, capability)[0];

  if (!provider) {
    return null;
  }

  const model = listModelsForCapability(catalog, capability, provider.id)[0];

  if (!model) {
    return null;
  }

  const profile = listProfilesForProvider(authProfiles, provider.id)[0];

  return {
    capability,
    priority: 0,
    providerId: provider.id,
    modelId: model.modelId,
    authProfileId: profile?.id ?? null,
    enabled: true
  } satisfies RouterPolicyCandidate;
}

function rewriteCapabilityCandidates(
  candidates: RouterPolicyCandidate[],
  capability: CapabilityFamily,
  rewrite: (group: RouterPolicyCandidate[]) => RouterPolicyCandidate[]
) {
  const nextGroup = rewrite(
    candidates
      .filter((candidate) => candidate.capability === capability)
      .sort(compareCandidates)
  );

  return normalizeCandidates([
    ...candidates.filter((candidate) => candidate.capability !== capability),
    ...nextGroup
  ]);
}

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

export function RouterPolicyEditor({
  workspaceId,
  catalog,
  policy,
  authProfiles
}: RouterPolicyEditorProps) {
  const [savedPolicy, setSavedPolicy] = useState<RouterPolicy>(() =>
    createInitialPolicy(workspaceId, policy)
  );
  const [draftPolicy, setDraftPolicy] = useState<RouterPolicy>(() =>
    createInitialPolicy(workspaceId, policy)
  );
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    message: null
  });

  useEffect(() => {
    const nextPolicy = createInitialPolicy(workspaceId, policy);
    setSavedPolicy(nextPolicy);
    setDraftPolicy(nextPolicy);
    setSaveState({
      status: "idle",
      message: null
    });
  }, [policy, workspaceId]);

  const isDirty =
    JSON.stringify(savedPolicy.candidates) !== JSON.stringify(draftPolicy.candidates);

  function updateDraftCandidates(
    update: (candidates: RouterPolicyCandidate[]) => RouterPolicyCandidate[]
  ) {
    setDraftPolicy((current) => ({
      ...current,
      candidates: normalizeCandidates(update(current.candidates))
    }));
    setSaveState({
      status: "idle",
      message: null
    });
  }

  function addCandidate(capability: CapabilityFamily) {
    const nextCandidate = buildDefaultCandidate(capability, catalog, authProfiles);

    if (!nextCandidate) {
      setSaveState({
        status: "error",
        message: `No supported provider/model pair is available for ${formatCapabilityLabel(capability)}.`
      });
      return;
    }

    updateDraftCandidates((current) => [...current, nextCandidate]);
  }

  function moveCandidate(capability: CapabilityFamily, index: number, direction: -1 | 1) {
    updateDraftCandidates((current) =>
      rewriteCapabilityCandidates(current, capability, (group) => {
        const targetIndex = index + direction;

        if (targetIndex < 0 || targetIndex >= group.length) {
          return group;
        }

        const nextGroup = [...group];
        const [candidate] = nextGroup.splice(index, 1);
        nextGroup.splice(targetIndex, 0, candidate);
        return nextGroup;
      })
    );
  }

  function removeCandidate(capability: CapabilityFamily, index: number) {
    updateDraftCandidates((current) =>
      rewriteCapabilityCandidates(current, capability, (group) =>
        group.filter((_, candidateIndex) => candidateIndex !== index)
      )
    );
  }

  function updateCandidate(
    capability: CapabilityFamily,
    index: number,
    update: (candidate: RouterPolicyCandidate) => RouterPolicyCandidate
  ) {
    updateDraftCandidates((current) =>
      rewriteCapabilityCandidates(current, capability, (group) =>
        group.map((candidate, candidateIndex) =>
          candidateIndex === index ? update(candidate) : candidate
        )
      )
    );
  }

  async function savePolicy() {
    setSaveState({
      status: "saving",
      message: null
    });

    try {
      const payload = {
        workspaceId,
        version: savedPolicy.version + 1,
        updatedAt: new Date().toISOString(),
        candidates: normalizeCandidates(draftPolicy.candidates)
      };
      const response = await fetch("/api/router/policy", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(readErrorMessage(body, "Failed to save router policy."));
      }

      const stored = normalizePolicy(RouterPolicySchema.parse(body));
      setSavedPolicy(stored);
      setDraftPolicy(stored);
      setSaveState({
        status: "saved",
        message: "Policy saved."
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to save router policy."
      });
    }
  }

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Routing policy
          </p>
          <h2 className="mt-2 font-serif text-xl tracking-tight text-ink">
            Capability routes
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="slate">{`v${savedPolicy.version}`}</Badge>
          <button
            type="button"
            onClick={savePolicy}
            disabled={!isDirty || saveState.status === "saving"}
            className="rounded-full border border-panel-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Save routing policy"
          >
            {saveState.status === "saving" ? "Saving policy" : "Save policy"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted">
        Add candidates, reorder them within each capability, and bind provider,
        model, and auth profile selection before saving the workspace policy.
      </p>

      {saveState.message ? (
        <p
          className={[
            "mt-4 text-sm leading-6",
            saveState.status === "error" ? "text-amber-900" : "text-muted"
          ].join(" ")}
        >
          {saveState.message}
        </p>
      ) : null}

      <div className="mt-6 space-y-5">
        {CAPABILITY_OPTIONS.map((capability) => {
          const capabilityCandidates = draftPolicy.candidates.filter(
            (candidate) => candidate.capability === capability
          );
          const providers = listProvidersForCapability(catalog, capability);

          return (
            <section
              key={capability}
              className="rounded-[1.5rem] border border-panel-line bg-surface-elevated p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {formatCapabilityLabel(capability)}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    {capabilityCandidates.length} candidate
                    {capabilityCandidates.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addCandidate(capability)}
                  className="rounded-full border border-panel-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-accent hover:text-accent"
                  aria-label={`Add ${capability} candidate`}
                >
                  Add candidate
                </button>
              </div>

              {capabilityCandidates.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-muted">
                  No candidates are configured for {formatCapabilityLabel(capability)}.
                </p>
              ) : (
                <ol className="mt-4 space-y-4">
                  {capabilityCandidates.map((candidate, index) => {
                    const models = listModelsForCapability(
                      catalog,
                      capability,
                      candidate.providerId
                    );
                    const profiles = listProfilesForProvider(
                      authProfiles,
                      candidate.providerId
                    );

                    return (
                      <li
                        key={`${capability}:${index}:${candidate.providerId}:${candidate.modelId}:${candidate.authProfileId ?? "auto"}`}
                        className="rounded-[1.25rem] border border-panel-line bg-panel px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              Candidate {index + 1}
                            </p>
                            <p className="text-xs uppercase tracking-[0.2em] text-muted">
                              Priority {candidate.priority}
                            </p>
                          </div>
                          <Badge
                            variant={candidate.enabled ? "emerald" : "slate"}
                            size="sm"
                          >
                            {candidate.enabled ? "enabled" : "disabled"}
                          </Badge>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                              Provider
                            </span>
                            <select
                              value={candidate.providerId}
                              onChange={(event) =>
                                updateCandidate(capability, index, (current) => {
                                  const nextProviderId = event.target.value;
                                  const nextModels = listModelsForCapability(
                                    catalog,
                                    capability,
                                    nextProviderId
                                  );
                                  const nextModel =
                                    nextModels.find(
                                      (model) => model.modelId === current.modelId
                                    ) ?? nextModels[0];
                                  const nextProfiles = listProfilesForProvider(
                                    authProfiles,
                                    nextProviderId
                                  );
                                  const nextAuthProfileId = nextProfiles.some(
                                    (profile) =>
                                      profile.id === current.authProfileId
                                  )
                                    ? current.authProfileId
                                    : nextProfiles[0]?.id ?? null;

                                  return {
                                    ...current,
                                    providerId: nextProviderId,
                                    modelId: nextModel?.modelId ?? current.modelId,
                                    authProfileId: nextAuthProfileId
                                  };
                                })
                              }
                              aria-label={`Provider for ${capability} candidate ${index + 1}`}
                              className="w-full rounded-[1rem] border border-panel-line bg-panel px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                            >
                              {providers.map((provider) => (
                                <option key={provider.id} value={provider.id}>
                                  {provider.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                              Model
                            </span>
                            <select
                              value={candidate.modelId}
                              onChange={(event) =>
                                updateCandidate(capability, index, (current) => ({
                                  ...current,
                                  modelId: event.target.value
                                }))
                              }
                              aria-label={`Model for ${capability} candidate ${index + 1}`}
                              className="w-full rounded-[1rem] border border-panel-line bg-panel px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                            >
                              {models.map((model) => (
                                <option key={model.modelId} value={model.modelId}>
                                  {model.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                              Auth profile
                            </span>
                            <select
                              value={candidate.authProfileId ?? ""}
                              onChange={(event) =>
                                updateCandidate(capability, index, (current) => ({
                                  ...current,
                                  authProfileId: event.target.value || null
                                }))
                              }
                              aria-label={`Auth profile for ${capability} candidate ${index + 1}`}
                              className="w-full rounded-[1rem] border border-panel-line bg-panel px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                            >
                              <option value="">Auto profile</option>
                              {profiles.map((profile) => (
                                <option key={profile.id} value={profile.id}>
                                  {profile.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => moveCandidate(capability, index, -1)}
                            disabled={index === 0}
                            className="rounded-full border border-panel-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Move ${capability} candidate ${index + 1} up`}
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCandidate(capability, index, 1)}
                            disabled={index === capabilityCandidates.length - 1}
                            className="rounded-full border border-panel-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Move ${capability} candidate ${index + 1} down`}
                          >
                            Move down
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateCandidate(capability, index, (current) => ({
                                ...current,
                                enabled: !current.enabled
                              }))
                            }
                            className="rounded-full border border-panel-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-accent hover:text-accent"
                            aria-label={`${candidate.enabled ? "Disable" : "Enable"} ${capability} candidate ${index + 1}`}
                          >
                            {candidate.enabled ? "Disable" : "Enable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCandidate(capability, index)}
                            className="rounded-full border border-panel-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:border-accent hover:text-accent"
                            aria-label={`Remove ${capability} candidate ${index + 1}`}
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge size="sm">{candidate.providerId}</Badge>
                          <Badge size="sm">{candidate.modelId}</Badge>
                          <Badge size="sm">
                            {resolveAuthProfileLabel(
                              authProfiles,
                              candidate.authProfileId
                            ) ?? "Auto profile"}
                          </Badge>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-8">
        <RoutePreviewPanel
          workspaceId={workspaceId}
          policyVersion={savedPolicy.version}
          authProfiles={authProfiles}
          isPolicyDirty={isDirty}
        />
      </div>
    </section>
  );
}
