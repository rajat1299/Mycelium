import type { AuthProfile, RouterPolicy } from "@computer-oss/protocol";
import { Badge } from "../ui/badge";

type RouterPolicyEditorProps = {
  policy: RouterPolicy | null;
  authProfiles: AuthProfile[];
};

function resolveProfileLabel(
  authProfiles: AuthProfile[],
  authProfileId: string | null
) {
  if (!authProfileId) {
    return "Auto profile";
  }

  return authProfiles.find((profile) => profile.id === authProfileId)?.label ?? authProfileId;
}

export function RouterPolicyEditor({
  policy,
  authProfiles
}: RouterPolicyEditorProps) {
  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Routing policy
          </p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight text-ink">
            Capability routes
          </h2>
        </div>
        <Badge variant="slate">
          {policy ? `v${policy.version}` : "No policy"}
        </Badge>
      </div>

      {!policy || policy.candidates.length === 0 ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-panel-line bg-white/60 p-6 text-sm leading-6 text-muted">
          No routing policy is saved for this workspace yet.
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {policy.candidates.map((candidate) => (
            <li
              key={`${candidate.capability}:${candidate.priority}:${candidate.providerId}:${candidate.modelId}`}
              className="rounded-[1.5rem] border border-panel-line bg-white/75 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {candidate.capability}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    Priority {candidate.priority}
                  </p>
                </div>
                <Badge variant={candidate.enabled ? "emerald" : "slate"} size="sm">
                  {candidate.enabled ? "enabled" : "disabled"}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge size="sm">{candidate.providerId}</Badge>
                <Badge size="sm">{candidate.modelId}</Badge>
                <Badge size="sm">
                  {resolveProfileLabel(authProfiles, candidate.authProfileId)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
