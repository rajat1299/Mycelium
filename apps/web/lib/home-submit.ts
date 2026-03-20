import { createOutcome, createPlan, createRun } from "./api";

export type HomeBootstrapResult = {
  outcomeId: string;
  planId: string | null;
  runId: string | null;
  bootstrapError: "plan" | "run" | null;
};

export async function bootstrapOutcomeFromHome(input: {
  workspaceId: string;
  userId: string;
  prompt: string;
}): Promise<HomeBootstrapResult> {
  const outcome = await createOutcome({
    workspaceId: input.workspaceId,
    userId: input.userId,
    prompt: input.prompt,
    source: "web"
  });

  try {
    const plan = await createPlan(outcome.id);

    try {
      const run = await createRun(outcome.id, { planId: plan.id });

      return {
        outcomeId: outcome.id,
        planId: plan.id,
        runId: run.id,
        bootstrapError: null
      };
    } catch {
      return {
        outcomeId: outcome.id,
        planId: plan.id,
        runId: null,
        bootstrapError: "run"
      };
    }
  } catch {
    return {
      outcomeId: outcome.id,
      planId: null,
      runId: null,
      bootstrapError: "plan"
    };
  }
}

export function buildOutcomeRedirectPath(result: HomeBootstrapResult) {
  const params = new URLSearchParams();

  if (result.runId) {
    params.set("runId", result.runId);
  }

  if (result.bootstrapError) {
    params.set("bootstrap", result.bootstrapError);
  }

  const query = params.toString();

  return query
    ? `/outcomes/${result.outcomeId}?${query}`
    : `/outcomes/${result.outcomeId}`;
}
