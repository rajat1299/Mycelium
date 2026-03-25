import { randomUUID } from "node:crypto";
import {
  AssistantMessageCompletedDataSchema,
  AssistantMessageDeltaDataSchema,
  AssistantMessageStartedDataSchema,
  ArtifactSchema,
  OutcomeSchema,
  PlanSchema,
  RunLogDataSchema,
  RunSchema,
  RunStepSchema,
  type AssistantMessageKind,
  type CapabilityFamily,
  type StepRoute
} from "@computer-oss/protocol";
import type { EventBus } from "./event-bus";
import type { Repositories } from "./repositories";

export type SimulatedExecutionTimeline = {
  kickoffMs: number;
  markRunningMs: number;
  contextCompleteMs: number;
  toolsCompleteMs: number;
  effectivenessCompleteMs: number;
  concernsCompleteMs: number;
  trendsCompleteMs: number;
  synthesisCompleteMs: number;
  streamChunkMs: number;
};

export type SimulatedExecutionService = {
  startRun(runId: string): void;
  waitForRun(runId: string): Promise<void>;
  close(): void;
};

type SimulatedExecutionServiceOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  now?: () => Date;
  timeline?: Partial<SimulatedExecutionTimeline>;
};

type StoredRun = Awaited<ReturnType<Repositories["runs"]["getById"]>>;
type StoredOutcome = Awaited<ReturnType<Repositories["outcomes"]["getById"]>>;
type StoredStep = Awaited<ReturnType<Repositories["runs"]["listSteps"]>>[number];

type PlanBlueprint = {
  idSuffix: string;
  kind: "root" | "task" | "synthesis";
  title: string;
  capability: CapabilityFamily;
  instruction: string;
  expectedArtifactPath: string;
  expectedArtifactKind: "analysis" | "result";
  position: number;
};

type IntermediateLog = {
  at: number;
  message: string;
};

const DEFAULT_TIMELINE: SimulatedExecutionTimeline = {
  kickoffMs: 900,
  markRunningMs: 450,
  contextCompleteMs: 2_600,
  toolsCompleteMs: 5_400,
  effectivenessCompleteMs: 5_900,
  concernsCompleteMs: 6_400,
  trendsCompleteMs: 5_100,
  synthesisCompleteMs: 4_800,
  streamChunkMs: 80
};

const MOCK_PLAN_BLUEPRINT: PlanBlueprint[] = [
  {
    idSuffix: "context-and-preferences",
    kind: "root",
    title: "Load context and working preferences",
    capability: "reasoning",
    instruction:
      "Inspect prior context, user preferences, and delivery expectations before planning or research begins.",
    expectedArtifactPath: "artifacts/context-and-preferences.md",
    expectedArtifactKind: "analysis",
    position: 0
  },
  {
    idSuffix: "research-tools",
    kind: "task",
    title: "Research AI tools used in K-12 classrooms",
    capability: "research",
    instruction:
      "Research which AI products teachers and schools are actually using in 2025-2026, including adoption evidence and concrete classroom workflows.",
    expectedArtifactPath: "artifacts/research-tools.md",
    expectedArtifactKind: "analysis",
    position: 1
  },
  {
    idSuffix: "research-effectiveness",
    kind: "task",
    title: "Research effectiveness studies and learning outcomes",
    capability: "research",
    instruction:
      "Collect source-backed findings about effectiveness, student outcomes, teacher productivity, and the limits of current evidence.",
    expectedArtifactPath: "artifacts/research-effectiveness.md",
    expectedArtifactKind: "analysis",
    position: 2
  },
  {
    idSuffix: "research-concerns",
    kind: "task",
    title: "Research concerns, challenges, and policy responses",
    capability: "research",
    instruction:
      "Identify implementation risks, policy responses, guardrails, and the concerns school leaders need to understand before deployment.",
    expectedArtifactPath: "artifacts/research-concerns.md",
    expectedArtifactKind: "analysis",
    position: 3
  },
  {
    idSuffix: "research-trends",
    kind: "task",
    title: "Research emerging trends and future outlook",
    capability: "research",
    instruction:
      "Map what is changing next across products, district adoption patterns, regulation, and the forward-looking market outlook.",
    expectedArtifactPath: "artifacts/research-trends.md",
    expectedArtifactKind: "analysis",
    position: 4
  },
  {
    idSuffix: "compile-pdf-report",
    kind: "synthesis",
    title: "Compile the polished PDF report",
    capability: "document",
    instruction:
      "Read all completed research tracks, synthesize them into a polished PDF report, and generate a concise executive summary for delivery.",
    expectedArtifactPath: "artifacts/ai-k12-education-report.pdf",
    expectedArtifactKind: "result",
    position: 5
  }
];

export function isDevelopmentSimulationEnabled(input: {
  simulationMode: boolean;
  outcomeSource: "web" | "schedule" | "slack" | "telegram";
}) {
  return input.simulationMode && input.outcomeSource === "web";
}

export function createSimulatedDraftPlan(input: {
  outcomeId: string;
  triggerMessageId: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}) {
  const planId = `plan_${input.outcomeId}_${input.triggerMessageId}`;
  const artifactRoot = buildSimulatedArtifactRoot(
    input.prompt,
    input.triggerMessageId
  );
  const nodes = MOCK_PLAN_BLUEPRINT.map((node) => ({
    id: `${planId}:${node.idSuffix}`,
    kind: node.kind,
    title: node.title,
    capability: node.capability,
    instruction: node.instruction,
    expectedArtifactPath: namespaceArtifactPath(
      artifactRoot,
      node.expectedArtifactPath
    ),
    expectedArtifactKind: node.expectedArtifactKind,
    position: node.position
  }));
  const rootNodeId = `${planId}:${MOCK_PLAN_BLUEPRINT[0].idSuffix}`;
  const synthesisNodeId = `${planId}:${MOCK_PLAN_BLUEPRINT[5].idSuffix}`;

  return PlanSchema.parse({
    id: planId,
    outcomeId: input.outcomeId,
    triggerMessageId: input.triggerMessageId,
    status: "draft",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    nodes,
    edges: [
      {
        id: `${planId}:edge-context-tools`,
        from: rootNodeId,
        to: `${planId}:${MOCK_PLAN_BLUEPRINT[1].idSuffix}`
      },
      {
        id: `${planId}:edge-context-effectiveness`,
        from: rootNodeId,
        to: `${planId}:${MOCK_PLAN_BLUEPRINT[2].idSuffix}`
      },
      {
        id: `${planId}:edge-context-concerns`,
        from: rootNodeId,
        to: `${planId}:${MOCK_PLAN_BLUEPRINT[3].idSuffix}`
      },
      {
        id: `${planId}:edge-context-trends`,
        from: rootNodeId,
        to: `${planId}:${MOCK_PLAN_BLUEPRINT[4].idSuffix}`
      },
      {
        id: `${planId}:edge-tools-report`,
        from: `${planId}:${MOCK_PLAN_BLUEPRINT[1].idSuffix}`,
        to: synthesisNodeId
      },
      {
        id: `${planId}:edge-effectiveness-report`,
        from: `${planId}:${MOCK_PLAN_BLUEPRINT[2].idSuffix}`,
        to: synthesisNodeId
      },
      {
        id: `${planId}:edge-concerns-report`,
        from: `${planId}:${MOCK_PLAN_BLUEPRINT[3].idSuffix}`,
        to: synthesisNodeId
      },
      {
        id: `${planId}:edge-trends-report`,
        from: `${planId}:${MOCK_PLAN_BLUEPRINT[4].idSuffix}`,
        to: synthesisNodeId
      }
    ]
  });
}

function buildSimulatedArtifactRoot(prompt: string, triggerMessageId: string) {
  const promptSlug = prompt
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const idSuffix = triggerMessageId.replace(/[^a-zA-Z0-9]+/g, "").slice(-8);
  const slug = promptSlug.length > 0 ? promptSlug : "turn";
  const uniqueSuffix = idSuffix.length > 0 ? idSuffix : "message";

  return `artifacts/${slug}-${uniqueSuffix}`;
}

function namespaceArtifactPath(artifactRoot: string, expectedArtifactPath: string) {
  const segments = expectedArtifactPath.split("/");
  const filename = segments.at(-1) ?? expectedArtifactPath;

  return `${artifactRoot}/${filename}`;
}

export function resolveSimulatedRoute(input: {
  capability: CapabilityFamily;
  resolvedAt: string;
}): StepRoute {
  switch (input.capability) {
    case "reasoning":
      return {
        capability: input.capability,
        providerId: "openai",
        modelId: "gpt-5.4",
        authProfileId: "simulated_openai_primary",
        policyVersion: 0,
        status: "resolved",
        reason: null,
        resolvedAt: input.resolvedAt
      };
    case "research":
      return {
        capability: input.capability,
        providerId: "openrouter",
        modelId: "openrouter/claude-sonnet-4.5",
        authProfileId: "simulated_openrouter_primary",
        policyVersion: 0,
        status: "resolved",
        reason: null,
        resolvedAt: input.resolvedAt
      };
    case "document":
      return {
        capability: input.capability,
        providerId: "anthropic",
        modelId: "claude-opus-4.6",
        authProfileId: "simulated_anthropic_primary",
        policyVersion: 0,
        status: "resolved",
        reason: null,
        resolvedAt: input.resolvedAt
      };
    default:
      return {
        capability: input.capability,
        providerId: "openrouter",
        modelId: "openrouter/claude-sonnet-4.5",
        authProfileId: "simulated_openrouter_primary",
        policyVersion: 0,
        status: "resolved",
        reason: null,
        resolvedAt: input.resolvedAt
      };
  }
}

export function createSimulatedExecutionService(
  options: SimulatedExecutionServiceOptions
): SimulatedExecutionService {
  const inFlightRuns = new Map<string, Promise<void>>();
  const settledRuns = new Map<string, Promise<void>>();
  const activeTimeouts = new Set<ReturnType<typeof setTimeout>>();
  const timeline = {
    ...DEFAULT_TIMELINE,
    ...options.timeline
  };
  const now = options.now ?? (() => new Date());
  let closed = false;

  function rememberSettledRun(runId: string, execution: Promise<void>) {
    settledRuns.set(runId, execution);
  }

  function wait(ms: number) {
    if (ms <= 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        activeTimeouts.delete(timeout);
        resolve();
      }, ms);

      activeTimeouts.add(timeout);
    });
  }

  const startRun = (runId: string) => {
    if (closed || inFlightRuns.has(runId)) {
      return;
    }

    settledRuns.delete(runId);

    const execution = executeSimulatedRun({
      runId,
      repositories: options.repositories,
      eventBus: options.eventBus,
      now,
      wait,
      timeline
    });

    inFlightRuns.set(runId, execution);
    void execution.then(
      () => {
        inFlightRuns.delete(runId);
        rememberSettledRun(runId, execution);
      },
      () => {
        inFlightRuns.delete(runId);
        rememberSettledRun(runId, execution);
      }
    );
  };

  return {
    startRun,
    async waitForRun(runId) {
      await (inFlightRuns.get(runId) ?? settledRuns.get(runId) ?? Promise.resolve());
    },
    close() {
      closed = true;

      for (const timeout of activeTimeouts) {
        clearTimeout(timeout);
      }

      activeTimeouts.clear();
    }
  };
}

async function executeSimulatedRun(input: {
  runId: string;
  repositories: Repositories;
  eventBus: EventBus;
  now: () => Date;
  wait: (ms: number) => Promise<void>;
  timeline: SimulatedExecutionTimeline;
}) {
  const run = await input.repositories.runs.getById(input.runId);

  if (!run) {
    return;
  }

  const outcome = await input.repositories.outcomes.getById(run.outcomeId);

  if (!outcome) {
    return;
  }

  const triggerMessage =
    await input.repositories.outcomes.getMessageById(run.triggerMessageId);
  const turnPrompt = triggerMessage?.content.trim() || outcome.prompt;
  const turnPromptSummary = summarizeTurnPrompt(turnPrompt);

  try {
    await input.wait(input.timeline.kickoffMs);
    await streamAssistantMessage(input, {
      outcomeId: outcome.id,
      runId: run.id,
      kind: "acknowledgment",
      content:
        `I'll start by loading relevant skills and checking context for ${turnPromptSummary}, then I'll run parallel research across all four topic areas.`
    });

    await input.wait(input.timeline.markRunningMs);
    const runningLifecycle = await input.repositories.runs.updateLifecycleStatus({
      runId: run.id,
      outcomeId: outcome.id,
      runStatus: "running",
      outcomeStatus: "running",
      updatedAt: input.now().toISOString()
    });

    if (!runningLifecycle) {
      return;
    }

    await emitRunUpdated(input, outcome.id, runningLifecycle.run);
    await emitOutcomeUpdated(input, runningLifecycle.outcome);

    const steps = [...(await input.repositories.runs.listSteps(run.id))].sort(
      (left, right) => left.position - right.position
    );
    const contextStep = steps.find((step) => step.position === 0);

    if (!contextStep) {
      return;
    }

    await emitRunLog(input, {
      outcomeId: outcome.id,
      runId: run.id,
      level: "info",
      message: `Checking for context about ${turnPromptSummary} and preferred document format.`
    });

    await runStepScenario(input, {
      outcome,
      run: runningLifecycle.run,
      step: contextStep,
      turnPrompt
    });

    await streamAssistantMessage(input, {
      outcomeId: outcome.id,
      runId: run.id,
      kind: "transition",
      content: "Let me run parallel research across all four topic areas."
    });
    await emitRunLog(input, {
      outcomeId: outcome.id,
      runId: run.id,
      level: "info",
      message: "Starting parallel research across all four topic areas."
    });

    const researchSteps = [...(await input.repositories.runs.listSteps(run.id))]
      .sort((left, right) => left.position - right.position)
      .filter((step) => step.kind === "task" && step.status === "ready");

    await Promise.all(
      researchSteps.map((step) =>
        runStepScenario(input, {
          outcome,
          run: runningLifecycle.run,
          step,
          turnPrompt
        })
      )
    );

    const synthesisStep = [...(await input.repositories.runs.listSteps(run.id))]
      .sort((left, right) => left.position - right.position)
      .find((step) => step.kind === "synthesis");

    if (!synthesisStep) {
      return;
    }

    await streamAssistantMessage(input, {
      outcomeId: outcome.id,
      runId: run.id,
      kind: "transition",
      content:
        "All four research tracks are complete. Let me read through the findings and then compile the PDF report."
    });
    await emitRunLog(input, {
      outcomeId: outcome.id,
      runId: run.id,
      level: "info",
      message: "Research complete, now building the PDF report."
    });

    const finalArtifact = await runStepScenario(input, {
      outcome,
      run: runningLifecycle.run,
      step: synthesisStep,
      turnPrompt
    });

    if (finalArtifact) {
      await createDerivedArtifactLineage(input, {
        runId: run.id,
        childArtifactId: finalArtifact.id,
        childStepId: synthesisStep.id
      });
    }

    await streamAssistantMessage(input, {
      outcomeId: outcome.id,
      runId: run.id,
      kind: "delivery",
      content:
        `Here's your report for ${turnPromptSummary} - a 16-page PDF covering the current state of AI in K-12 education.\n\n- Executive summary with adoption, time-saved, and market-size stats\n- Tools teachers are actually using in classrooms\n- Effectiveness research and where the evidence is still limited\n- Concerns, implementation risks, and policy responses\n- Emerging trends and where the market is heading next`
    });

    const completedLifecycle = await input.repositories.runs.updateLifecycleStatus({
      runId: run.id,
      outcomeId: outcome.id,
      runStatus: "completed",
      outcomeStatus: "completed",
      updatedAt: input.now().toISOString()
    });

    if (!completedLifecycle) {
      return;
    }

    await emitRunUpdated(input, outcome.id, completedLifecycle.run);
    await emitOutcomeUpdated(input, completedLifecycle.outcome);
    await emitRunLog(input, {
      outcomeId: outcome.id,
      runId: run.id,
      level: "info",
      message: "Mock narrative run complete. Final report delivered with four research tracks and a PDF summary."
    });
  } catch (error) {
    const failedLifecycle = await input.repositories.runs.updateLifecycleStatus({
      runId: run.id,
      outcomeId: outcome.id,
      runStatus: "failed",
      outcomeStatus: "failed",
      updatedAt: input.now().toISOString()
    });

    if (failedLifecycle) {
      await emitRunUpdated(input, outcome.id, failedLifecycle.run);
      await emitOutcomeUpdated(input, failedLifecycle.outcome);
    }

    await emitRunLog(input, {
      outcomeId: outcome.id,
      runId: run.id,
      level: "error",
      message:
        error instanceof Error
          ? error.message
          : "The mock narrative run failed before completion."
    });
  }
}

async function runStepScenario(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
    now: () => Date;
    wait: (ms: number) => Promise<void>;
    timeline: SimulatedExecutionTimeline;
  },
  input: {
    outcome: StoredOutcome & {};
    run: StoredRun & {};
    step: StoredStep;
    turnPrompt: string;
  }
) {
  const runningStep = await options.repositories.runs.updateStepStatus({
    stepId: input.step.id,
    status: "running",
    updatedAt: options.now().toISOString()
  });

  if (!runningStep) {
    return null;
  }

  await emitRunStepUpdated(options, input.outcome.id, runningStep);
  await emitRunLog(options, {
    outcomeId: input.outcome.id,
    runId: input.run.id,
    stepId: runningStep.id,
    stepTitle: runningStep.title,
    level: "info",
    message: runningMessageForStep(runningStep)
  });

  await waitWithProgress(
    options,
    delayForStep(options.timeline, runningStep),
    {
      outcomeId: input.outcome.id,
      runId: input.run.id,
      stepId: runningStep.id,
      stepTitle: runningStep.title
    },
    intermediateMessagesForStep(runningStep.position)
  );

  return completeStep(options, {
    outcome: input.outcome,
    run: input.run,
    step: runningStep,
    turnPrompt: input.turnPrompt
  });
}

async function completeStep(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
    now: () => Date;
  },
  input: {
    outcome: StoredOutcome & {};
    run: StoredRun & {};
    step: StoredStep;
    turnPrompt: string;
  }
) {
  const artifact = await createArtifactForStep(options, {
    outcome: input.outcome,
    runId: input.run.id,
    step: input.step,
    turnPrompt: input.turnPrompt
  });

  const completedStep = await options.repositories.runs.updateStepStatus({
    stepId: input.step.id,
    status: "completed",
    updatedAt: options.now().toISOString()
  });

  if (!completedStep) {
    return artifact;
  }

  await emitRunStepUpdated(options, input.outcome.id, completedStep);
  await emitRunLog(options, {
    outcomeId: input.outcome.id,
    runId: input.run.id,
    stepId: completedStep.id,
    stepTitle: completedStep.title,
    level: "info",
    message: completionMessageForStep(completedStep, artifact.relativePath)
  });

  const releasedDependents = await options.repositories.runs.releaseReadyDependents({
    runId: input.run.id,
    completedStepId: completedStep.id,
    updatedAt: options.now().toISOString()
  });

  for (const readyStep of releasedDependents) {
    await emitRunStepUpdated(options, input.outcome.id, readyStep);
  }

  return artifact;
}

async function createArtifactForStep(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
    now: () => Date;
  },
  input: {
    outcome: StoredOutcome & {};
    runId: string;
    step: StoredStep;
    turnPrompt: string;
  }
) {
  const descriptor = artifactDescriptorForStep(input.step, input.turnPrompt);
  const artifact = await options.repositories.artifacts.create({
    id: `artifact_${randomUUID()}`,
    outcomeId: input.outcome.id,
    runId: input.runId,
    stepId: input.step.id,
    kind: descriptor.kind,
    relativePath: descriptor.relativePath,
    size: descriptor.size,
    metadata: descriptor.metadata,
    createdAt: options.now().toISOString()
  });

  await emitArtifactCreated(options, input.outcome.id, artifact);
  return artifact;
}

function summarizeTurnPrompt(prompt: string) {
  const normalized = prompt.trim().replace(/\s+/g, " ");

  if (normalized.length <= 88) {
    return normalized;
  }

  return `${normalized.slice(0, 85).trimEnd()}...`;
}

async function createDerivedArtifactLineage(
  options: {
    repositories: Repositories;
    now: () => Date;
  },
  input: {
    runId: string;
    childArtifactId: string;
    childStepId: string;
  }
) {
  const artifacts = await options.repositories.artifacts.listByRun(input.runId);
  const parentArtifacts = artifacts.filter(
    (artifact) =>
      artifact.id !== input.childArtifactId &&
      artifact.stepId &&
      artifact.stepId !== input.childStepId
  );

  if (parentArtifacts.length === 0) {
    return;
  }

  await options.repositories.artifactLineage.createMany(
    parentArtifacts.map((artifact) => ({
      id: `lineage_${randomUUID()}`,
      runId: input.runId,
      parentArtifactId: artifact.id,
      childArtifactId: input.childArtifactId,
      parentStepId: artifact.stepId!,
      childStepId: input.childStepId,
      relation: "derived_from",
      createdAt: options.now().toISOString()
    }))
  );
}

function delayForStep(
  timeline: SimulatedExecutionTimeline,
  step: Pick<StoredStep, "position">
) {
  switch (step.position) {
    case 0:
      return timeline.contextCompleteMs;
    case 1:
      return timeline.toolsCompleteMs;
    case 2:
      return timeline.effectivenessCompleteMs;
    case 3:
      return timeline.concernsCompleteMs;
    case 4:
      return timeline.trendsCompleteMs;
    default:
      return timeline.synthesisCompleteMs;
  }
}

function intermediateMessagesForStep(position: number): IntermediateLog[] {
  switch (position) {
    case 0:
      return [
        {
          at: 0.25,
          message: "Querying saved context for role, formatting preferences, and past research patterns."
        },
        {
          at: 0.55,
          message: "Checking whether prior sessions contain a reusable report structure or citation format."
        },
        {
          at: 0.82,
          message: "Preparing context notes for the research phase and surfacing document expectations."
        }
      ];
    case 1:
      return [
        {
          at: 0.18,
          message: "Searching 2025-2026 sources for the AI tools teachers are actually using in classrooms."
        },
        {
          at: 0.45,
          message: "Comparing district adoption signals, classroom workflows, and product-specific usage evidence."
        },
        {
          at: 0.78,
          message: "Summarizing the strongest tool-adoption findings and writing the tools brief."
        }
      ];
    case 2:
      return [
        {
          at: 0.2,
          message: "Collecting studies, pilots, and source-backed findings on learning outcomes and teacher productivity."
        },
        {
          at: 0.5,
          message: "Filtering for stronger methodology, clearer metrics, and the most defensible claims."
        },
        {
          at: 0.8,
          message: "Drafting the effectiveness summary with quantified takeaways and open questions."
        }
      ];
    case 3:
      return [
        {
          at: 0.16,
          message: "Scanning policy guidance, district guardrails, and implementation risks tied to classroom AI use."
        },
        {
          at: 0.48,
          message: "Organizing concerns around privacy, accuracy, equity, and teacher workflow friction."
        },
        {
          at: 0.8,
          message: "Writing the concerns brief with policy responses, mitigations, and operator notes."
        }
      ];
    case 4:
      return [
        {
          at: 0.2,
          message: "Tracking emerging product patterns, district demand shifts, and near-term market direction."
        },
        {
          at: 0.52,
          message: "Comparing trend signals across funding, policy, classroom workflows, and platform capabilities."
        },
        {
          at: 0.82,
          message: "Drafting the outlook brief with trend lines and next-year implications."
        }
      ];
    default:
      return [
        {
          at: 0.18,
          message: "Reading research-tools.md and extracting the most concrete adoption findings."
        },
        {
          at: 0.38,
          message: "Reading research-effectiveness.md and ranking the strongest claims by confidence."
        },
        {
          at: 0.56,
          message: "Reading research-concerns.md and research-trends.md to round out the report structure."
        },
        {
          at: 0.82,
          message: "Building the PDF report and final executive summary with source-backed sections."
        }
      ];
  }
}

async function waitWithProgress(
  input: {
    wait: (ms: number) => Promise<void>;
    repositories: Repositories;
    eventBus: EventBus;
    now: () => Date;
  },
  totalMs: number,
  logContext: {
    outcomeId: string;
    runId: string;
    stepId: string;
    stepTitle: string;
  },
  intermediates: IntermediateLog[]
) {
  let elapsed = 0;
  const sorted = [...intermediates].sort((left, right) => left.at - right.at);

  for (const entry of sorted) {
    const targetMs = Math.floor(totalMs * entry.at);
    const gap = targetMs - elapsed;

    if (gap > 0) {
      await input.wait(gap);
      elapsed = targetMs;
    }

    await emitRunLog(input, {
      ...logContext,
      level: "info",
      message: entry.message
    });
  }

  const remaining = totalMs - elapsed;

  if (remaining > 0) {
    await input.wait(remaining);
  }
}

function runningMessageForStep(step: Pick<StoredStep, "position">) {
  switch (step.position) {
    case 0:
      return "Checking for context about the user's role, preferences, and output format.";
    case 1:
      return "Researching which AI tools teachers are using in K-12 classrooms.";
    case 2:
      return "Researching effectiveness studies, learning outcomes, and teacher productivity findings.";
    case 3:
      return "Researching implementation concerns, policy responses, and operational risks.";
    case 4:
      return "Researching emerging trends, near-term shifts, and the future outlook.";
    default:
      return "Reading the completed research tracks and compiling the PDF report.";
  }
}

function completionMessageForStep(
  step: Pick<StoredStep, "position">,
  relativePath: string
) {
  switch (step.position) {
    case 0:
      return `Context and preferences loaded. Saved to ${relativePath}.`;
    case 1:
      return `Research complete. Saved to ${relativePath}.`;
    case 2:
      return `Effectiveness research complete. Saved to ${relativePath}.`;
    case 3:
      return `Concerns and policy research complete. Saved to ${relativePath}.`;
    case 4:
      return `Trend research complete. Saved to ${relativePath}.`;
    default:
      return `PDF report compiled and saved to ${relativePath}.`;
  }
}

function artifactDescriptorForStep(
  step: Pick<
    StoredStep,
    "position" | "expectedArtifactPath" | "expectedArtifactKind"
  >,
  prompt: string
) {
  const relativePath = step.expectedArtifactPath ?? `artifacts/${step.position + 1}.md`;
  const kind = step.expectedArtifactKind ?? "analysis";
  const topic = prompt.trim().replace(/\s+/g, " ").slice(0, 96);

  switch (step.position) {
    case 0:
      return {
        relativePath,
        kind,
        size: 2_048,
        metadata: {
          title: "Context and working preferences",
          summary:
            "Loaded document expectations, citation requirements, and reusable context before research began.",
          lineCount: 42,
          byteSize: 2_048
        }
      };
    case 1:
      return {
        relativePath,
        kind,
        size: 28_672,
        metadata: {
          title: "AI tools in K-12 classrooms (2025-2026)",
          summary: `Adoption and classroom workflow findings for: ${topic}.`,
          lineCount: 621,
          byteSize: 28_672
        }
      };
    case 2:
      return {
        relativePath,
        kind,
        size: 26_944,
        metadata: {
          title: "AI effectiveness in K-12 education",
          summary: `Effectiveness findings, limitations, and outcome measures for: ${topic}.`,
          lineCount: 569,
          byteSize: 26_944
        }
      };
    case 3:
      return {
        relativePath,
        kind,
        size: 22_304,
        metadata: {
          title: "Concerns, challenges, and policy responses",
          summary: `Risks, implementation barriers, and policy responses for: ${topic}.`,
          lineCount: 514,
          byteSize: 22_304
        }
      };
    case 4:
      return {
        relativePath,
        kind,
        size: 19_968,
        metadata: {
          title: "Emerging trends and future outlook",
          summary: `Trend lines, adoption shifts, and market outlook for: ${topic}.`,
          lineCount: 402,
          byteSize: 19_968
        }
      };
    default:
      return {
        relativePath,
        kind,
        size: 45_312,
        metadata: {
          title: "The State of AI in K-12 Education",
          summary: `A polished PDF report synthesizing the four research tracks for: ${topic}.`,
          pageCount: 16,
          byteSize: 45_312,
          previewStats: [
            { label: "Adoption", value: "60%" },
            { label: "Time saved", value: "5.9 hrs" },
            { label: "Sources", value: "34+" },
            { label: "Market", value: "$7.6B" }
          ]
        }
      };
  }
}

function chunkAssistantContent(content: string) {
  const tokens = content.split(/(\s+)/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const token of tokens) {
    const next = `${current}${token}`;

    if (current.length > 0 && next.length > 42) {
      chunks.push(current);
      current = token;
      continue;
    }

    current = next;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

async function streamAssistantMessage(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
    now: () => Date;
    wait: (ms: number) => Promise<void>;
    timeline: SimulatedExecutionTimeline;
  },
  input: {
    outcomeId: string;
    runId: string;
    kind: AssistantMessageKind;
    content: string;
  }
) {
  const messageId = `assistant_${randomUUID()}`;
  const createdAt = options.now().toISOString();

  await emitAssistantMessageStarted(options, input.outcomeId, {
    messageId,
    runId: input.runId,
    kind: input.kind,
    createdAt
  });

  let content = "";
  const chunks = chunkAssistantContent(input.content);

  for (const chunk of chunks) {
    content += chunk;

    await emitAssistantMessageDelta(options, input.outcomeId, {
      messageId,
      runId: input.runId,
      kind: input.kind,
      delta: chunk,
      content,
      createdAt,
      updatedAt: options.now().toISOString()
    });
    await options.wait(options.timeline.streamChunkMs);
  }

  await emitAssistantMessageCompleted(options, input.outcomeId, {
    messageId,
    runId: input.runId,
    kind: input.kind,
    content: input.content,
    createdAt,
    completedAt: options.now().toISOString()
  });
}

async function emitOutcomeUpdated(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
  },
  outcome: StoredOutcome & {}
) {
  const data = OutcomeSchema.parse(outcome);

  options.eventBus.publish({
    outcomeId: data.id,
    type: "outcome.updated",
    data
  });
}

async function emitRunUpdated(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
  },
  outcomeId: string,
  run: StoredRun & {}
) {
  const data = RunSchema.parse(run);

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.id,
    eventType: "run.updated",
    payload: data,
    createdAt: data.updatedAt
  });

  options.eventBus.publish({
    outcomeId,
    type: "run.updated",
    data
  });
}

async function emitRunStepUpdated(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
  },
  outcomeId: string,
  step: StoredStep
) {
  const data = RunStepSchema.parse(step);

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.runId,
    eventType: "run.step.updated",
    payload: data,
    createdAt: data.updatedAt
  });

  options.eventBus.publish({
    outcomeId,
    type: "run.step.updated",
    data
  });
}

async function emitRunLog(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
    now: () => Date;
  },
  input: {
    outcomeId: string;
    runId: string;
    stepId?: string;
    stepTitle?: string;
    level: "info" | "error";
    message: string;
  }
) {
  const createdAt = options.now().toISOString();
  const data = RunLogDataSchema.parse({
    runId: input.runId,
    ...(input.stepId ? { stepId: input.stepId } : {}),
    ...(input.stepTitle ? { stepTitle: input.stepTitle } : {}),
    level: input.level,
    message: input.message,
    createdAt
  });

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.runId,
    eventType: "run.log",
    payload: data,
    createdAt
  });

  options.eventBus.publish({
    outcomeId: input.outcomeId,
    type: "run.log",
    data
  });
}

async function emitArtifactCreated(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
  },
  outcomeId: string,
  artifact: Awaited<ReturnType<Repositories["artifacts"]["create"]>>
) {
  const data = ArtifactSchema.parse(artifact);

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.runId ?? "run_unknown",
    eventType: "artifact.created",
    payload: data,
    createdAt: data.createdAt
  });

  options.eventBus.publish({
    outcomeId,
    type: "artifact.created",
    data
  });
}

async function emitAssistantMessageStarted(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
  },
  outcomeId: string,
  input: {
    messageId: string;
    runId: string;
    kind: AssistantMessageKind;
    createdAt: string;
  }
) {
  const data = AssistantMessageStartedDataSchema.parse(input);

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.runId,
    eventType: "assistant.message.started",
    payload: data,
    createdAt: data.createdAt
  });

  options.eventBus.publish({
    outcomeId,
    type: "assistant.message.started",
    data
  });
}

async function emitAssistantMessageDelta(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
  },
  outcomeId: string,
  input: {
    messageId: string;
    runId: string;
    kind: AssistantMessageKind;
    delta: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  }
) {
  const data = AssistantMessageDeltaDataSchema.parse(input);

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.runId,
    eventType: "assistant.message.delta",
    payload: data,
    createdAt: data.updatedAt
  });

  options.eventBus.publish({
    outcomeId,
    type: "assistant.message.delta",
    data
  });
}

async function emitAssistantMessageCompleted(
  options: {
    repositories: Repositories;
    eventBus: EventBus;
  },
  outcomeId: string,
  input: {
    messageId: string;
    runId: string;
    kind: AssistantMessageKind;
    content: string;
    createdAt: string;
    completedAt: string;
  }
) {
  const data = AssistantMessageCompletedDataSchema.parse(input);

  await options.repositories.runs.appendEvent({
    id: `event_${randomUUID()}`,
    runId: data.runId,
    eventType: "assistant.message.completed",
    payload: data,
    createdAt: data.completedAt
  });

  options.eventBus.publish({
    outcomeId,
    type: "assistant.message.completed",
    data
  });
}
