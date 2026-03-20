import {
  ApprovalListResponseSchema,
  ApprovalSchema,
  AuditListResponseSchema,
  AuthProfileSchema,
  ArtifactListResponseSchema,
  ArtifactLineageListResponseSchema,
  CheckpointDetailSchema,
  CheckpointListResponseSchema,
  CreateRunRequestSchema,
  CreateOutcomeRequestSchema,
  ExternalConversationBindingSchema,
  MessagingConnectionSchema,
  MessagingDeliverySchema,
  OutcomeListResponseSchema,
  OutcomeSchema,
  PlanSchema,
  ProviderCatalogSchema,
  RemoteWorkerSchema,
  ResumeRunResponseSchema,
  RunDetailSchema,
  RunLogListResponseSchema,
  RouterPolicySchema,
  ScheduleListResponseSchema,
  ScheduleSchema,
  WorkspaceCredentialMetadataSchema,
  CreateOutcomeMessageRequestSchema,
  type CreateOutcomeRequest,
  type CreateOutcomeMessageRequest,
  type CreateRunRequest,
  type AuthProfile,
  type Approval,
  type AuditEvent,
  type ArtifactLineageEdge,
  type CheckpointDetail,
  type CheckpointSummary,
  type ExternalConversationBinding,
  type MessagingConnection,
  type MessagingDelivery,
  type Outcome,
  type RemoteWorker,
  type Schedule,
  type RunLogData
} from "@computer-oss/protocol";
import { z } from "zod";

const DEFAULT_CONTROL_PLANE_URL = "http://127.0.0.1:4000";
const DEFAULT_WORKSPACE_ID = "ws_default";
const DEFAULT_USER_ID = "user_default";

export function getControlPlaneBaseUrl() {
  return process.env.CONTROL_PLANE_URL ?? DEFAULT_CONTROL_PLANE_URL;
}

export function getDefaultWorkspaceId() {
  return process.env.COMPUTER_OSS_WORKSPACE_ID ?? DEFAULT_WORKSPACE_ID;
}

export function getDefaultUserId() {
  return process.env.COMPUTER_OSS_USER_ID ?? DEFAULT_USER_ID;
}

async function parseJson<T>(response: Response, parser: (value: unknown) => T): Promise<T> {
  return parser(await response.json());
}

const WorkspaceCredentialListEnvelopeSchema = z.object({
  credentials: z.array(z.unknown())
});

const AuthProfileListEnvelopeSchema = z.object({
  authProfiles: z.array(z.unknown())
});

const RouterPolicyResponseEnvelopeSchema = z.object({
  policy: z.unknown().nullable()
});

const WorkerListEnvelopeSchema = z.object({
  workers: z.array(z.unknown())
});

const OutcomeMessageHistorySchema = z.object({
  connection: z.unknown().nullable(),
  bindings: z.array(z.unknown()),
  deliveries: z.array(z.unknown())
});

export async function listOutcomes(workspaceId: string): Promise<Outcome[]> {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/outcomes?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return [];
    }

    const parsed = await parseJson(response, (value) =>
      OutcomeListResponseSchema.parse(value)
    );

    return parsed.outcomes;
  } catch {
    return [];
  }
}

export async function getOutcome(id: string): Promise<Outcome | null> {
  try {
    const response = await fetch(`${getControlPlaneBaseUrl()}/api/outcomes/${id}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return parseJson(response, (value) => OutcomeSchema.parse(value));
  } catch {
    return null;
  }
}

export async function createOutcome(input: CreateOutcomeRequest): Promise<Outcome> {
  const payload = CreateOutcomeRequestSchema.parse(input);
  const response = await fetch(`${getControlPlaneBaseUrl()}/api/outcomes`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to create outcome.");
  }

  return parseJson(response, (value) => OutcomeSchema.parse(value));
}

export async function createOutcomeMessage(
  outcomeId: string,
  input: CreateOutcomeMessageRequest
) {
  const payload = CreateOutcomeMessageRequestSchema.parse(input);
  const response = await fetch(
    `${getControlPlaneBaseUrl()}/api/outcomes/${outcomeId}/messages`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Failed to append outcome message.");
  }

  return response.json();
}

export async function getPlan(outcomeId: string) {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/outcomes/${outcomeId}/plan`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return null;
    }

    return parseJson(response, (value) => PlanSchema.parse(value));
  } catch {
    return null;
  }
}

export async function createPlan(outcomeId: string) {
  const response = await fetch(
    `${getControlPlaneBaseUrl()}/api/outcomes/${outcomeId}/plan`,
    {
      method: "POST",
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Failed to create draft plan.");
  }

  return parseJson(response, (value) => PlanSchema.parse(value));
}

export async function getRun(runId: string) {
  try {
    const response = await fetch(`${getControlPlaneBaseUrl()}/api/runs/${runId}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return parseJson(response, (value) => RunDetailSchema.parse(value));
  } catch {
    return null;
  }
}

export async function getLatestRun(outcomeId: string) {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/outcomes/${outcomeId}/runs/latest`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return null;
    }

    return parseJson(response, (value) => RunDetailSchema.parse(value));
  } catch {
    return null;
  }
}

export async function createRun(outcomeId: string, input: CreateRunRequest) {
  const payload = CreateRunRequestSchema.parse(input);
  const response = await fetch(
    `${getControlPlaneBaseUrl()}/api/outcomes/${outcomeId}/runs`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Failed to create run.");
  }

  return parseJson(response, (value) => RunDetailSchema.parse(value));
}

export async function getRunArtifacts(runId: string) {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/runs/${runId}/artifacts`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return [];
    }

    const parsed = await parseJson(response, (value) =>
      ArtifactListResponseSchema.parse(value)
    );

    return parsed.artifacts;
  } catch {
    return [];
  }
}

export async function getRunLogs(runId: string) {
  try {
    const response = await fetch(`${getControlPlaneBaseUrl()}/api/runs/${runId}/logs`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    const parsed = await parseJson(response, (value) =>
      RunLogListResponseSchema.parse(value)
    );

    return parsed.logs;
  } catch {
    return [];
  }
}

export async function getRunArtifactLineage(
  runId: string
): Promise<ArtifactLineageEdge[]> {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/runs/${runId}/artifact-lineage`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return [];
    }

    const parsed = await parseJson(response, (value) =>
      ArtifactLineageListResponseSchema.parse(value)
    );

    return parsed.edges;
  } catch {
    return [];
  }
}

export async function getRunCheckpoints(
  runId: string
): Promise<CheckpointSummary[]> {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/runs/${runId}/checkpoints`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return [];
    }

    const parsed = await parseJson(response, (value) =>
      CheckpointListResponseSchema.parse(value)
    );

    return parsed.checkpoints;
  } catch {
    return [];
  }
}

export async function getCheckpoint(
  checkpointId: string
): Promise<CheckpointDetail | null> {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/checkpoints/${checkpointId}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return null;
    }

    return parseJson(response, (value) => CheckpointDetailSchema.parse(value));
  } catch {
    return null;
  }
}

export async function getRunAudit(runId: string): Promise<AuditEvent[]> {
  try {
    const response = await fetch(`${getControlPlaneBaseUrl()}/api/runs/${runId}/audit`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    const parsed = await parseJson(response, (value) =>
      AuditListResponseSchema.parse(value)
    );

    return parsed.events;
  } catch {
    return [];
  }
}

export async function resumeRun(
  runId: string,
  input: { checkpointId?: string } = {}
) {
  const response = await fetch(
    `${getControlPlaneBaseUrl()}/api/runs/${runId}/resume`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Failed to resume run.");
  }

  return parseJson(response, (value) => ResumeRunResponseSchema.parse(value));
}

export async function listSchedules(workspaceId: string): Promise<Schedule[]> {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/workspaces/${encodeURIComponent(workspaceId)}/schedules`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return [];
    }

    const parsed = await parseJson(response, (value) =>
      ScheduleListResponseSchema.parse(value)
    );

    return parsed.schedules.map((schedule) => ScheduleSchema.parse(schedule));
  } catch {
    return [];
  }
}

async function getMessagingConnection(
  workspaceId: string,
  channel: "slack" | "telegram"
): Promise<MessagingConnection | null> {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/workspaces/${encodeURIComponent(workspaceId)}/${channel}/connection`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return null;
    }

    const parsed = await parseJson(response, (value) =>
      z.object({ connection: z.unknown().nullable() }).parse(value)
    );

    if (parsed.connection === null) {
      return null;
    }

    return MessagingConnectionSchema.parse(parsed.connection);
  } catch {
    return null;
  }
}

export async function getSlackConnection(workspaceId: string) {
  return getMessagingConnection(workspaceId, "slack");
}

export async function getTelegramConnection(workspaceId: string) {
  return getMessagingConnection(workspaceId, "telegram");
}

export async function getOutcomeMessageHistory(outcomeId: string): Promise<{
  connection: MessagingConnection | null;
  bindings: ExternalConversationBinding[];
  deliveries: MessagingDelivery[];
} | null> {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/outcomes/${outcomeId}/messages/history`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return null;
    }

    const parsed = await parseJson(response, (value) =>
      OutcomeMessageHistorySchema.parse(value)
    );

    return {
      connection:
        parsed.connection === null
          ? null
          : MessagingConnectionSchema.parse(parsed.connection),
      bindings: parsed.bindings.map((binding) =>
        ExternalConversationBindingSchema.parse(binding)
      ),
      deliveries: parsed.deliveries.map((delivery) =>
        MessagingDeliverySchema.parse(delivery)
      )
    };
  } catch {
    return null;
  }
}

export async function getProviderCatalog() {
  try {
    const response = await fetch(`${getControlPlaneBaseUrl()}/api/providers/models`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        providers: [],
        models: []
      };
    }

    return parseJson(response, (value) => ProviderCatalogSchema.parse(value));
  } catch {
    return {
      providers: [],
      models: []
    };
  }
}

export async function listWorkspaceCredentials(workspaceId: string) {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/workspace-credentials?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return [];
    }

    const parsed = await parseJson(response, (value) =>
      WorkspaceCredentialListEnvelopeSchema.parse(value)
    );

    return parsed.credentials.map((credential) =>
      WorkspaceCredentialMetadataSchema.parse(credential)
    );
  } catch {
    return [];
  }
}

export async function listAuthProfiles(workspaceId: string): Promise<AuthProfile[]> {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/auth-profiles?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return [];
    }

    const parsed = await parseJson(response, (value) =>
      AuthProfileListEnvelopeSchema.parse(value)
    );

    return parsed.authProfiles.map((authProfile) =>
      AuthProfileSchema.parse(authProfile)
    );
  } catch {
    return [];
  }
}

export async function listApprovals(workspaceId: string): Promise<Approval[]> {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/approvals?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return [];
    }

    const parsed = await parseJson(response, (value) =>
      ApprovalListResponseSchema.parse(value)
    );

    return parsed.approvals.map((approval) => ApprovalSchema.parse(approval));
  } catch {
    return [];
  }
}

export async function listWorkers(workspaceId: string): Promise<RemoteWorker[]> {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/workers?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return [];
    }

    const parsed = await parseJson(response, (value) =>
      WorkerListEnvelopeSchema.parse(value)
    );

    return parsed.workers.map((worker) => RemoteWorkerSchema.parse(worker));
  } catch {
    return [];
  }
}

export async function getRouterPolicy(workspaceId: string) {
  try {
    const response = await fetch(
      `${getControlPlaneBaseUrl()}/api/router/policy?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return null;
    }

    const parsed = await parseJson(response, (value) =>
      RouterPolicyResponseEnvelopeSchema.parse(value)
    );

    if (parsed.policy === null) {
      return null;
    }

    return RouterPolicySchema.parse(parsed.policy);
  } catch {
    return null;
  }
}

export function getControlPlaneEventUrl(outcomeId: string) {
  return `${getControlPlaneBaseUrl()}/api/outcomes/${outcomeId}/events`;
}
