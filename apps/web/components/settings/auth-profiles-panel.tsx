import type { AuthProfile } from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type AuthProfilesPanelProps = {
  authProfiles: AuthProfile[];
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

export function AuthProfilesPanel({ authProfiles }: AuthProfilesPanelProps) {
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
