"use client";

import { useEffect, useState } from "react";
import type {
  AuthProfile,
  MessagingConnection,
  ProviderCatalog,
  RouterPolicy,
  Schedule,
  WorkspaceCredentialMetadata
} from "@computer-oss/protocol";
import { AuthProfilesPanel } from "./auth-profiles-panel";
import { MessagingPanel } from "./messaging-panel";
import { ProviderCatalog as ProviderCatalogPanel } from "./provider-catalog";
import { RouterPolicyEditor } from "./router-policy-editor";
import { SchedulesPanel } from "./schedules-panel";
import { WorkspaceCredentialsPanel } from "./workspace-credentials-panel";

type SettingsWorkspaceShellProps = {
  workspaceId: string;
  catalog: ProviderCatalog;
  credentials: WorkspaceCredentialMetadata[];
  authProfiles: AuthProfile[];
  policy: RouterPolicy | null;
  schedules: Schedule[];
  slackConnection: MessagingConnection | null;
  telegramConnection: MessagingConnection | null;
};

function sortCredentials(credentials: WorkspaceCredentialMetadata[]) {
  return [...credentials].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt.localeCompare(left.updatedAt);
    }

    return left.label.localeCompare(right.label);
  });
}

function sortAuthProfiles(authProfiles: AuthProfile[]) {
  return [...authProfiles].sort((left, right) => {
    if (left.providerId !== right.providerId) {
      return left.providerId.localeCompare(right.providerId);
    }

    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return left.label.localeCompare(right.label);
  });
}

export function SettingsWorkspaceShell({
  workspaceId,
  catalog,
  credentials,
  authProfiles,
  policy,
  schedules,
  slackConnection,
  telegramConnection
}: SettingsWorkspaceShellProps) {
  const [credentialState, setCredentialState] = useState(() =>
    sortCredentials(credentials)
  );
  const [authProfileState, setAuthProfileState] = useState(() =>
    sortAuthProfiles(authProfiles)
  );

  useEffect(() => {
    setCredentialState(sortCredentials(credentials));
  }, [credentials]);

  useEffect(() => {
    setAuthProfileState(sortAuthProfiles(authProfiles));
  }, [authProfiles]);

  return (
    <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-8">
        <ProviderCatalogPanel catalog={catalog} />
        <RouterPolicyEditor
          workspaceId={workspaceId}
          catalog={catalog}
          policy={policy}
          authProfiles={authProfileState}
        />
        <SchedulesPanel workspaceId={workspaceId} schedules={schedules} />
      </div>
      <div className="space-y-8">
        <WorkspaceCredentialsPanel
          workspaceId={workspaceId}
          catalog={catalog}
          credentials={credentialState}
          onCredentialCreated={(credential) =>
            setCredentialState((current) =>
              sortCredentials([
                credential,
                ...current.filter((item) => item.id !== credential.id)
              ])
            )
          }
        />
        <AuthProfilesPanel
          workspaceId={workspaceId}
          catalog={catalog}
          credentials={credentialState}
          authProfiles={authProfileState}
          onAuthProfileCreated={(authProfile) =>
            setAuthProfileState((current) =>
              sortAuthProfiles([
                authProfile,
                ...current.filter((item) => item.id !== authProfile.id)
              ])
            )
          }
        />
        <MessagingPanel
          workspaceId={workspaceId}
          slackConnection={slackConnection}
          telegramConnection={telegramConnection}
        />
      </div>
    </section>
  );
}
