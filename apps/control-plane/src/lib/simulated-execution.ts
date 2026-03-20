import { randomUUID } from "node:crypto";
import {
  ArtifactSchema,
  OutcomeSchema,
  PlanSchema,
  RunLogDataSchema,
  RunSchema,
  RunStepSchema,
  type CapabilityFamily,
  type StepRoute
} from "@computer-oss/protocol";
import type { EventBus } from "./event-bus";
import type { Repositories } from "./repositories";

export type SimulatedExecutionTimeline = {
  kickoffMs: number;
  markRunningMs: number;
  memoryCompleteMs: number;
  landscapeCompleteMs: number;
  evidenceCompleteMs: number;
  policyCompleteMs: number;
  synthesisCompleteMs: number;
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

const DEFAULT_TIMELINE: SimulatedExecutionTimeline = {
  kickoffMs: 500,
  markRunningMs: 300,
  memoryCompleteMs: 700,
  landscapeCompleteMs: 2_200,
  evidenceCompleteMs: 3_700,
  policyCompleteMs: 4_700,
  synthesisCompleteMs: 3_000
};

export function isDevelopmentSimulationEnabled(input: {
  simulationMode: boolean;
  outcomeSource: "web" | "schedule" | "slack" | "telegram";
}) {
  return input.simulationMode && input.outcomeSource === "web";
}

export function createSimulatedDraftPlan(input: {
  outcomeId: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}) {
  return PlanSchema.parse({
    id: `plan_${input.outcomeId}`,
    outcomeId: input.outcomeId,
    status: "draft",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    nodes: [
      {
        id: `${input.outcomeId}:memory-check`,
        kind: "root",
        title: "Check memory and working context",
        capability: "reasoning",
        instruction:
          "Inspect prior context, preferred output style, and useful operating assumptions before research begins.",
        expectedArtifactPath: "artifacts/context-check.md",
        expectedArtifactKind: "analysis",
        position: 0
      },
      {
        id: `${input.outcomeId}:research-landscape`,
        kind: "task",
        title: "Research the current landscape",
        capability: "research",
        instruction:
          "Map the current landscape, current-state examples, and notable signals relevant to the request.",
        expectedArtifactPath: "artifacts/research-landscape.md",
        expectedArtifactKind: "analysis",
        position: 1
      },
      {
        id: `${input.outcomeId}:research-evidence`,
        kind: "task",
        title: "Review evidence and effectiveness",
        capability: "research",
        instruction:
          "Collect evidence, studies, and source-backed effectiveness claims relevant to the request.",
        expectedArtifactPath: "artifacts/research-evidence.md",
        expectedArtifactKind: "analysis",
        position: 2
      },
      {
        id: `${input.outcomeId}:research-policy`,
        kind: "task",
        title: "Map challenges and policy response",
        capability: "research",
        instruction:
          "Identify risks, challenges, and policy or operator responses that matter for the decision.",
        expectedArtifactPath: "artifacts/research-policy.md",
        expectedArtifactKind: "analysis",
        position: 3
      },
      {
        id: `${input.outcomeId}:compile-report`,
        kind: "synthesis",
        title: "Compile the final report",
        capability: "document",
        instruction:
          "Synthesize the research tracks into a polished final report with clear findings, recommendations, and delivery metadata.",
        expectedArtifactPath: "artifacts/final-report.pdf",
        expectedArtifactKind: "result",
        position: 4
      }
    ],
    edges: [
      {
        id: `${input.outcomeId}:edge-memory-landscape`,
        from: `${input.outcomeId}:memory-check`,
        to: `${input.outcomeId}:research-landscape`
      },
      {
        id: `${input.outcomeId}:edge-memory-evidence`,
        from: `${input.outcomeId}:memory-check`,
        to: `${input.outcomeId}:research-evidence`
      },
      {
        id: `${input.outcomeId}:edge-memory-policy`,
        from: `${input.outcomeId}:memory-check`,
        to: `${input.outcomeId}:research-policy`
      },
      {
        id: `${input.outcomeId}:edge-landscape-report`,
        from: `${input.outcomeId}:research-landscape`,
        to: `${input.outcomeId}:compile-report`
      },
      {
        id: `${input.outcomeId}:edge-evidence-report`,
        from: `${input.outcomeId}:research-evidence`,
        to: `${input.outcomeId}:compile-report`
      },
      {
        id: `${input.outcomeId}:edge-policy-report`,
        from: `${input.outcomeId}:research-policy`,
        to: `${input.outcomeId}:compile-report`
      }
    ]
  });
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

  try {
    await input.wait(input.timeline.kickoffMs);
    await emitRunLog(input, {
      outcomeId: outcome.id,
      runId: run.id,
      level: "info",
      message:
        "I’m checking memory and spinning up parallel research tracks before I compile the final report."
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
    const memoryStep = steps[0];

    if (!memoryStep) {
      return;
    }

    const runningMemoryStep = await input.repositories.runs.updateStepStatus({
      stepId: memoryStep.id,
      status: "running",
      updatedAt: input.now().toISOString()
    });

    if (!runningMemoryStep) {
      return;
    }

    await emitRunStepUpdated(input, outcome.id, runningMemoryStep);
    await emitRunLog(input, {
      outcomeId: outcome.id,
      runId: run.id,
      stepId: runningMemoryStep.id,
      stepTitle: runningMemoryStep.title,
      level: "info",
      message: runningMessageForStep(runningMemoryStep)
    });

    await input.wait(delayForStep(input.timeline, runningMemoryStep));
    await completeStep(input, {
      outcome,
      run: runningLifecycle.run,
      step: runningMemoryStep
    });

    await emitRunLog(input, {
      outcomeId: outcome.id,
      runId: run.id,
      level: "info",
      message:
        "Memory check is complete. I’m launching the research tracks in parallel now."
    });

    const researchSteps = [...(await input.repositories.runs.listSteps(run.id))]
      .sort((left, right) => left.position - right.position)
      .filter((step) => step.kind === "task" && step.status === "ready");

    await Promise.all(
      researchSteps.map(async (step) => {
        const runningStep = await input.repositories.runs.updateStepStatus({
          stepId: step.id,
          status: "running",
          updatedAt: input.now().toISOString()
        });

        if (!runningStep) {
          return;
        }

        await emitRunStepUpdated(input, outcome.id, runningStep);
        await emitRunLog(input, {
          outcomeId: outcome.id,
          runId: run.id,
          stepId: runningStep.id,
          stepTitle: runningStep.title,
          level: "info",
          message: runningMessageForStep(runningStep)
        });

        await input.wait(delayForStep(input.timeline, runningStep));
        await completeStep(input, {
          outcome,
          run: runningLifecycle.run,
          step: runningStep
        });
      })
    );

    const synthesisStep = [...(await input.repositories.runs.listSteps(run.id))]
      .sort((left, right) => left.position - right.position)
      .find((step) => step.kind === "synthesis");

    if (!synthesisStep) {
      return;
    }

    await emitRunLog(input, {
      outcomeId: outcome.id,
      runId: run.id,
      level: "info",
      message:
        "All parallel research tracks are complete. I’m compiling the final deliverable now."
    });

    const runningSynthesisStep = await input.repositories.runs.updateStepStatus({
      stepId: synthesisStep.id,
      status: "running",
      updatedAt: input.now().toISOString()
    });

    if (!runningSynthesisStep) {
      return;
    }

    await emitRunStepUpdated(input, outcome.id, runningSynthesisStep);
    await emitRunLog(input, {
      outcomeId: outcome.id,
      runId: run.id,
      stepId: runningSynthesisStep.id,
      stepTitle: runningSynthesisStep.title,
      level: "info",
      message: runningMessageForStep(runningSynthesisStep)
    });

    await input.wait(input.timeline.synthesisCompleteMs);
    const finalArtifact = await completeStep(input, {
      outcome,
      run: runningLifecycle.run,
      step: runningSynthesisStep
    });

    if (finalArtifact) {
      await createDerivedArtifactLineage(input, {
        outcomeId: outcome.id,
        runId: run.id,
        childArtifactId: finalArtifact.id,
        childStepId: runningSynthesisStep.id
      });
    }

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
      message:
        "Work complete. The final report is ready with a preview card, share controls, and downloadable output."
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
          : "The simulated run failed before completion."
    });
  }
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
  }
) {
  const artifact = await createArtifactForStep(options, {
    outcome: input.outcome,
    runId: input.run.id,
    step: input.step
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
  }
) {
  const descriptor = artifactDescriptorForStep(input.step, input.outcome.prompt);
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

async function createDerivedArtifactLineage(
  options: {
    repositories: Repositories;
    now: () => Date;
  },
  input: {
    outcomeId: string;
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
      return timeline.memoryCompleteMs;
    case 1:
      return timeline.landscapeCompleteMs;
    case 2:
      return timeline.evidenceCompleteMs;
    case 3:
      return timeline.policyCompleteMs;
    default:
      return timeline.synthesisCompleteMs;
  }
}

function runningMessageForStep(step: Pick<StoredStep, "position" | "title">) {
  switch (step.position) {
    case 0:
      return "Checking memory, working context, and preferred output shape.";
    case 1:
      return "Running landscape research to capture current examples, tools, and operating signals.";
    case 2:
      return "Reviewing studies, evidence, and effectiveness claims for the request.";
    case 3:
      return "Mapping concerns, risks, and policy or operator responses.";
    default:
      return "Reading the completed research tracks and compiling the final report.";
  }
}

function completionMessageForStep(
  step: Pick<StoredStep, "position" | "title">,
  relativePath: string
) {
  switch (step.position) {
    case 0:
      return `Memory and skills context checked. Saved notes to ${relativePath}.`;
    case 1:
      return `Landscape research complete. Saved the summary to ${relativePath}.`;
    case 2:
      return `Evidence review complete. Saved the research to ${relativePath}.`;
    case 3:
      return `Challenges and policy mapping complete. Saved the research to ${relativePath}.`;
    default:
      return `Final report compiled and delivered at ${relativePath}.`;
  }
}

function artifactDescriptorForStep(
  step: Pick<StoredStep, "position" | "expectedArtifactPath" | "expectedArtifactKind">,
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
        size: 1_284,
        metadata: {
          title: "Memory and context check",
          summary: "Checked memory, preferred formats, and reusable context. No prior context was found for this exact request.",
          lineCount: 28,
          byteSize: 1_284
        }
      };
    case 1:
      return {
        relativePath,
        kind,
        size: 18_944,
        metadata: {
          title: "Landscape research",
          summary: `Current-state landscape notes for: ${topic}.`,
          lineCount: 214,
          byteSize: 18_944
        }
      };
    case 2:
      return {
        relativePath,
        kind,
        size: 24_608,
        metadata: {
          title: "Evidence review",
          summary: `Evidence and effectiveness findings for: ${topic}.`,
          lineCount: 289,
          byteSize: 24_608
        }
      };
    case 3:
      return {
        relativePath,
        kind,
        size: 16_512,
        metadata: {
          title: "Challenges and policy response",
          summary: `Risks, constraints, and policy-response notes for: ${topic}.`,
          lineCount: 173,
          byteSize: 16_512
        }
      };
    default:
      return {
        relativePath,
        kind,
        size: 45_312,
        metadata: {
          title: "Final report",
          summary: `A polished final deliverable for: ${topic}.`,
          pageCount: 16,
          byteSize: 45_312,
          previewStats: [
            { label: "Coverage", value: "60%" },
            { label: "Reading time", value: "5.9 hrs" },
            { label: "Sources", value: "34+" },
            { label: "Market size", value: "$7.6B" }
          ]
        }
      };
  }
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
