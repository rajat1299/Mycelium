import {
  ArtifactListResponseSchema,
  CreateRunRequestSchema,
  CreateOutcomeRequestSchema,
  OutcomeListResponseSchema,
  OutcomeSchema,
  PlanSchema,
  RunDetailSchema,
  type CreateOutcomeRequest,
  type CreateRunRequest,
  type Outcome
} from "@computer-oss/protocol";

const DEFAULT_CONTROL_PLANE_URL = "http://127.0.0.1:4000";
const DEFAULT_WORKSPACE_ID = "ws_default";
const DEFAULT_USER_ID = "user_default";

function getControlPlaneBaseUrl() {
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

export function getControlPlaneEventUrl(outcomeId: string) {
  return `${getControlPlaneBaseUrl()}/api/outcomes/${outcomeId}/events`;
}
