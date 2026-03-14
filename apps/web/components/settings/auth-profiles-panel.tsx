"use client";

import { useEffect, useState } from "react";
import type {
  AuthProfile,
  ProviderCatalog,
  WorkspaceCredentialMetadata
} from "@computer-oss/protocol";
import { AuthProfileSchema } from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type AuthProfilesPanelProps = {
  workspaceId: string;
  catalog: ProviderCatalog;
  credentials: WorkspaceCredentialMetadata[];
  authProfiles: AuthProfile[];
  onAuthProfileCreated: (authProfile: AuthProfile) => void;
};

function formatProfileStatus(status: AuthProfile["status"]) {
  switch (status) {
    case "active":
      return "emerald";
    case "cooling_down":
      return "amber";
    default:
      return "slate";
  }
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

export function AuthProfilesPanel({
  workspaceId,
  catalog,
  credentials,
  authProfiles,
  onAuthProfileCreated
}: AuthProfilesPanelProps) {
  const [providerId, setProviderId] = useState(catalog.providers[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [priority, setPriority] = useState("1");
  const [credentialId, setCredentialId] = useState("");
  const [statusMessage, setStatusMessage] = useState<{
    tone: "default" | "error";
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const matchingCredentials = credentials.filter(
    (credential) => credential.providerId === providerId
  );

  useEffect(() => {
    if (catalog.providers.some((provider) => provider.id === providerId)) {
      return;
    }

    setProviderId(catalog.providers[0]?.id ?? "");
  }, [catalog.providers, providerId]);

  useEffect(() => {
    if (matchingCredentials.some((credential) => credential.id === credentialId)) {
      return;
    }

    setCredentialId(matchingCredentials[0]?.id ?? "");
  }, [credentialId, matchingCredentials]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedPriority = Number(priority);

    if (!providerId || !label.trim() || !credentialId || Number.isNaN(parsedPriority)) {
      setStatusMessage({
        tone: "error",
        text: "Provider, label, credential, and priority are required."
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/auth-profiles", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          workspaceId,
          providerId,
          label: label.trim(),
          credentialId,
          priority: parsedPriority
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Failed to create auth profile."));
      }

      const authProfile = AuthProfileSchema.parse(payload);
      onAuthProfileCreated(authProfile);
      setLabel("");
      setPriority("1");
      setStatusMessage({
        tone: "default",
        text: "Auth profile created."
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Failed to create auth profile."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Auth profiles
          </p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight text-ink">
            Routing identities
          </h2>
        </div>
        <Badge variant="slate">{authProfiles.length} profiles</Badge>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted">
        Auth profiles are the named routing identities that policy candidates and
        persisted step routes point to.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Provider
            </span>
            <select
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
              className="w-full rounded-[1rem] border border-panel-line bg-white/85 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
            >
              {catalog.providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Auth profile label
            </span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="w-full rounded-[1rem] border border-panel-line bg-white/85 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              placeholder="OpenAI Primary"
              aria-label="Auth profile label"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Credential
            </span>
            <select
              value={credentialId}
              onChange={(event) => setCredentialId(event.target.value)}
              className="w-full rounded-[1rem] border border-panel-line bg-white/85 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
            >
              {matchingCredentials.length === 0 ? (
                <option value="">No credentials for this provider</option>
              ) : null}
              {matchingCredentials.map((credential) => (
                <option key={credential.id} value={credential.id}>
                  {credential.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Priority
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="w-full rounded-[1rem] border border-panel-line bg-white/85 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-muted">
            Choose a credential for the same provider. The control plane enforces
            provider and workspace ownership.
          </p>
          <button
            type="submit"
            disabled={isSubmitting || matchingCredentials.length === 0}
            className="rounded-full border border-panel-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating auth profile" : "Create auth profile"}
          </button>
        </div>
      </form>

      {statusMessage ? (
        <p
          className={[
            "mt-4 text-sm leading-6",
            statusMessage.tone === "error" ? "text-amber-900" : "text-muted"
          ].join(" ")}
        >
          {statusMessage.text}
        </p>
      ) : null}

      {authProfiles.length === 0 ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-panel-line bg-white/60 p-6 text-sm leading-6 text-muted">
          No auth profiles are configured for this workspace yet.
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {authProfiles.map((profile) => (
            <li
              key={profile.id}
              className="rounded-[1.5rem] border border-panel-line bg-white/75 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{profile.label}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    {profile.providerId}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={formatProfileStatus(profile.status)} size="sm">
                    {profile.status}
                  </Badge>
                  <Badge variant="slate" size="sm">
                    priority {profile.priority}
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                Credential: {profile.credentialId}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
