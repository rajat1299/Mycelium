import Link from "next/link";
import { SettingsWorkspaceShell } from "../../components/settings/settings-workspace-shell";
import {
  getDefaultWorkspaceId,
  getProviderCatalog,
  getRouterPolicy,
  listAuthProfiles,
  listWorkspaceCredentials
} from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const workspaceId = getDefaultWorkspaceId();
  const [catalog, credentials, authProfiles, policy] = await Promise.all([
    getProviderCatalog(),
    listWorkspaceCredentials(workspaceId),
    listAuthProfiles(workspaceId),
    getRouterPolicy(workspaceId)
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-10">
      <header className="grid gap-4 border-b border-panel-line pb-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent">
            Settings
          </p>
          <h1 className="max-w-3xl font-serif text-4xl tracking-tight text-ink sm:text-5xl">
            Provider routing and BYO keys
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            Review the provider catalog, saved credentials, auth profiles, and the
            current routing policy for this workspace.
          </p>
        </div>
        <div className="rounded-3xl border border-panel-line bg-panel p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Active workspace
          </p>
          <p className="mt-4 text-lg font-semibold text-ink">{workspaceId}</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full border border-panel-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent hover:text-accent"
          >
            Back to outcomes
          </Link>
        </div>
      </header>

      <SettingsWorkspaceShell
        workspaceId={workspaceId}
        catalog={catalog}
        credentials={credentials}
        authProfiles={authProfiles}
        policy={policy}
      />
    </main>
  );
}
