import { startOutcome } from "./api";

export type HomeBootstrapResult = {
  outcomeId: string;
  runId: string | null;
};

export async function bootstrapOutcomeFromHome(input: {
  workspaceId: string;
  userId: string;
  prompt: string;
}): Promise<HomeBootstrapResult> {
  const response = await startOutcome({
    workspaceId: input.workspaceId,
    userId: input.userId,
    prompt: input.prompt,
    source: "web"
  });

  return {
    outcomeId: response.outcome.id,
    runId: response.run?.id ?? null
  };
}

export function buildOutcomeRedirectPath(result: HomeBootstrapResult) {
  const params = new URLSearchParams();

  if (result.runId) {
    params.set("runId", result.runId);
  }

  const query = params.toString();

  return query
    ? `/outcomes/${result.outcomeId}?${query}`
    : `/outcomes/${result.outcomeId}`;
}
