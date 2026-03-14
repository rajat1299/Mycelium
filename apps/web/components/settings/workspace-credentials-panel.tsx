"use client";

import { useEffect, useState } from "react";
import {
  WorkspaceCredentialMetadataSchema,
  type ProviderCatalog,
  type WorkspaceCredentialMetadata
} from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type WorkspaceCredentialsPanelProps = {
  workspaceId: string;
  catalog: ProviderCatalog;
  credentials: WorkspaceCredentialMetadata[];
  onCredentialCreated: (credential: WorkspaceCredentialMetadata) => void;
};

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not validated";
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

export function WorkspaceCredentialsPanel({
  workspaceId,
  catalog,
  credentials,
  onCredentialCreated
}: WorkspaceCredentialsPanelProps) {
  const [providerId, setProviderId] = useState(catalog.providers[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [statusMessage, setStatusMessage] = useState<{
    tone: "default" | "error";
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (catalog.providers.some((provider) => provider.id === providerId)) {
      return;
    }

    setProviderId(catalog.providers[0]?.id ?? "");
  }, [catalog.providers, providerId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!providerId || !label.trim() || !secret.trim()) {
      setStatusMessage({
        tone: "error",
        text: "Provider, label, and secret are all required."
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/workspace-credentials", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          workspaceId,
          providerId,
          label: label.trim(),
          secret: secret.trim()
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          readErrorMessage(payload, "Failed to create workspace credential.")
        );
      }

      const credential = WorkspaceCredentialMetadataSchema.parse(payload);
      onCredentialCreated(credential);
      setLabel("");
      setSecret("");
      setStatusMessage({
        tone: "default",
        text: "Credential stored. Plaintext secret is no longer shown."
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to create workspace credential."
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
            Workspace credentials
          </p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight text-ink">
            Saved secrets
          </h2>
        </div>
        <Badge variant="slate">{credentials.length} credentials</Badge>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted">
        Submit provider secrets once. The control plane stores encrypted metadata,
        and the raw secret is never rendered back into the web UI.
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
              Credential label
            </span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="w-full rounded-[1rem] border border-panel-line bg-white/85 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              placeholder="OpenAI Primary"
              aria-label="Credential label"
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Credential secret
          </span>
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            className="w-full rounded-[1rem] border border-panel-line bg-white/85 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
            placeholder="sk-..."
            aria-label="Credential secret"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-muted">
            The encryption key must already be configured on the control plane for
            writes to succeed.
          </p>
          <button
            type="submit"
            disabled={isSubmitting || catalog.providers.length === 0}
            className="rounded-full border border-panel-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Adding credential" : "Add credential"}
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

      {credentials.length === 0 ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-panel-line bg-white/60 p-6 text-sm leading-6 text-muted">
          No credentials are saved for this workspace yet.
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {credentials.map((credential) => (
            <li
              key={credential.id}
              className="rounded-[1.5rem] border border-panel-line bg-white/75 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{credential.label}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    {credential.providerId}
                  </p>
                </div>
                <Badge
                  variant={credential.status === "active" ? "emerald" : "amber"}
                  size="sm"
                >
                  {credential.status}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                Last validated: {formatTimestamp(credential.lastValidatedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
