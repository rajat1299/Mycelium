import type { WorkspaceCredentialMetadata } from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type WorkspaceCredentialsPanelProps = {
  credentials: WorkspaceCredentialMetadata[];
};

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not validated";
}

export function WorkspaceCredentialsPanel({
  credentials
}: WorkspaceCredentialsPanelProps) {
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
