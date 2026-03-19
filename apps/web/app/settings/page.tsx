import { SettingsWorkspaceShell } from "../../components/settings/settings-workspace-shell";
import {
  getDefaultWorkspaceId,
  getProviderCatalog,
  getRouterPolicy,
  getSlackConnection,
  getTelegramConnection,
  listAuthProfiles,
  listSchedules,
  listWorkspaceCredentials
} from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const workspaceId = getDefaultWorkspaceId();
  const [catalog, credentials, authProfiles, policy, schedules, slackConnection, telegramConnection] = await Promise.all([
    getProviderCatalog(),
    listWorkspaceCredentials(workspaceId),
    listAuthProfiles(workspaceId),
    getRouterPolicy(workspaceId),
    listSchedules(workspaceId),
    getSlackConnection(workspaceId),
    getTelegramConnection(workspaceId)
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-10">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Settings
        </p>
        <h1 className="font-serif text-xl tracking-tight text-ink">
          Workspace configuration
        </h1>
        <p className="text-sm text-muted">
          Routing, schedules, and messaging for this workspace.
        </p>
      </div>

      <SettingsWorkspaceShell
        workspaceId={workspaceId}
        catalog={catalog}
        credentials={credentials}
        authProfiles={authProfiles}
        policy={policy}
        schedules={schedules}
        slackConnection={slackConnection}
        telegramConnection={telegramConnection}
      />
    </main>
  );
}
