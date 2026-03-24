import { randomUUID } from "node:crypto";
import {
  CapabilityFamilySchema,
  MessageCreatedDataSchema,
  OutcomeSchema,
  OutcomeTurnResponseSchema,
  PlanSchema,
  RunDetailSchema,
  RunSchema,
  RunStepSchema,
  type ContinueOutcomeRequest,
  type Outcome,
  type OutcomeTurnResponse,
  type StartOutcomeRequest
} from "@computer-oss/protocol";
import {
  createDeterministicDraftPlan,
  validatePlanGraph
} from "@computer-oss/orchestrator";
import type { EventBus } from "./event-bus";
import type { ExecutionService } from "./execution-service";
import type { Repositories } from "./repositories";
import type { RouterService } from "./router-service";
import {
  createSimulatedDraftPlan,
  isDevelopmentSimulationEnabled,
  resolveSimulatedRoute,
  type SimulatedExecutionService
} from "./simulated-execution";

type StartExecutionService = Pick<ExecutionService, "startRun">;
type StartSimulatedExecutionService = Pick<SimulatedExecutionService, "startRun">;
type ResolveRouteService = Pick<RouterService, "resolveRoute">;

export type StartThreadInput = StartOutcomeRequest;

export type ContinueThreadInput = ContinueOutcomeRequest & {
  outcomeId: string;
};

export type OutcomeTurnService = {
  startThread(input: StartThreadInput): Promise<OutcomeTurnResponse>;
  continueThread(input: ContinueThreadInput): Promise<OutcomeTurnResponse>;
};

type CreateOutcomeTurnServiceOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  executionService: StartExecutionService;
  simulatedExecutionService: StartSimulatedExecutionService;
  routerService: ResolveRouteService;
  simulationMode?: boolean;
  now?: () => Date;
  idFactory?: () => string;
};

type TurnRunStartOptions = Omit<CreateOutcomeTurnServiceOptions, "idFactory"> & {
  idFactory: () => string;
};

type TurnPlanInput = {
  outcome: Outcome;
  triggerMessage: {
    id: string;
    outcomeId: string;
    role: "user";
    content: string;
    createdAt: string;
  };
  prompt: string;
};

function createPrefixedId(idFactory: () => string, prefix: string) {
  return `${prefix}_${idFactory()}`;
}

async function buildPlanDetail(
  repositories: Repositories,
  planId: string
): Promise<ReturnType<typeof PlanSchema.parse> | null> {
  const plan = await repositories.plans.getById(planId);

  if (!plan) {
    return null;
  }

  const [nodes, edges] = await Promise.all([
    repositories.plans.listNodes(plan.id),
    repositories.plans.listEdges(plan.id)
  ]);

  return PlanSchema.parse({
    ...plan,
    nodes,
    edges
  });
}

async function buildRunDetail(
  repositories: Repositories,
  runId: string
): Promise<ReturnType<typeof RunDetailSchema.parse> | null> {
  const run = await repositories.runs.getById(runId);

  if (!run) {
    return null;
  }

  const steps = await repositories.runs.listSteps(run.id);

  return RunDetailSchema.parse({
    ...run,
    steps
  });
}

async function persistDraftPlan(
  options: CreateOutcomeTurnServiceOptions,
  input: TurnPlanInput
) {
  const createdAt = input.triggerMessage.createdAt;
  const useSimulatedPlan = isDevelopmentSimulationEnabled({
    simulationMode: options.simulationMode ?? false,
    outcomeSource: input.outcome.source
  });
  const draftPlan = useSimulatedPlan
    ? createSimulatedDraftPlan({
        outcomeId: input.outcome.id,
        triggerMessageId: input.triggerMessage.id,
        prompt: input.prompt,
        createdAt,
        updatedAt: createdAt
      })
    : createDeterministicDraftPlan({
        outcomeId: input.outcome.id,
        triggerMessageId: input.triggerMessage.id,
        prompt: input.prompt,
        createdAt,
        updatedAt: createdAt
      });
  const validation = validatePlanGraph(draftPlan);

  if (!validation.ok) {
    throw new Error(
      `Generated plan is invalid: ${"errors" in validation ? validation.errors.join("; ") : "unknown validation failure"}`
    );
  }

  await options.repositories.plans.create({
    id: draftPlan.id,
    outcomeId: draftPlan.outcomeId,
    triggerMessageId: draftPlan.triggerMessageId,
    status: draftPlan.status,
    createdAt: draftPlan.createdAt,
    updatedAt: draftPlan.updatedAt,
    nodes: draftPlan.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      title: node.title,
      capability: node.capability,
      instruction: node.instruction,
      template: node.template,
      approvalRequirement: node.approvalRequirement,
      expectedArtifactPath: node.expectedArtifactPath,
      expectedArtifactKind: node.expectedArtifactKind
    })),
    edges: draftPlan.edges
  });

  const persistedPlan = await buildPlanDetail(options.repositories, draftPlan.id);

  if (!persistedPlan) {
    throw new Error(`Failed to read persisted plan ${draftPlan.id}.`);
  }

  options.eventBus.publish({
    outcomeId: input.outcome.id,
    type: "plan.created",
    data: persistedPlan
  });

  return persistedPlan;
}

async function resolveAndPersistStepRoutes(
  options: TurnRunStartOptions,
  input: {
    outcome: Outcome;
    runId: string;
    resolvedAt: string;
  }
) {
  const useSimulatedRoutes = isDevelopmentSimulationEnabled({
    simulationMode: options.simulationMode ?? false,
    outcomeSource: input.outcome.source
  });
  const steps = await options.repositories.runs.listSteps(input.runId);

  await Promise.all(
    steps.map(async (step) => {
      const route = useSimulatedRoutes
        ? resolveSimulatedRoute({
            capability: CapabilityFamilySchema.parse(step.capability),
            resolvedAt: input.resolvedAt
          })
        : await options.routerService.resolveRoute({
            workspaceId: input.outcome.workspaceId,
            capability: CapabilityFamilySchema.parse(step.capability),
            resolvedAt: input.resolvedAt
          });

      const updated = await options.repositories.runs.updateStepRoute({
        stepId: step.id,
        route
      });

      if (!updated) {
        throw new Error(`Step ${step.id} disappeared during route persistence.`);
      }
    })
  );
}

async function publishInitialRunEvents(
  options: TurnRunStartOptions,
  input: {
    outcomeId: string;
    run: ReturnType<typeof RunDetailSchema.parse>;
  }
) {
  const runEventData = RunSchema.parse({
    id: input.run.id,
    outcomeId: input.run.outcomeId,
    planId: input.run.planId,
    triggerMessageId: input.run.triggerMessageId,
    status: input.run.status,
    latestCheckpointId: input.run.latestCheckpointId,
    resumable: input.run.resumable,
    createdAt: input.run.createdAt,
    updatedAt: input.run.updatedAt
  });

  await options.repositories.runs.appendEvent({
    id: createPrefixedId(options.idFactory, "event"),
    runId: input.run.id,
    eventType: "run.created",
    payload: runEventData,
    createdAt: input.run.createdAt
  });

  options.eventBus.publish({
    outcomeId: input.outcomeId,
    type: "run.created",
    data: runEventData
  });

  for (const step of input.run.steps) {
    const stepEventData = RunStepSchema.parse(step);

    await options.repositories.runs.appendEvent({
      id: createPrefixedId(options.idFactory, "event"),
      runId: input.run.id,
      eventType: "run.step.updated",
      payload: stepEventData,
      createdAt: step.updatedAt
    });

    options.eventBus.publish({
      outcomeId: input.outcomeId,
      type: "run.step.updated",
      data: stepEventData
    });
  }
}

export async function createQueuedRunFromPlan(
  options: TurnRunStartOptions,
  input: {
    outcome: Outcome;
    planId: string;
    triggerMessageId: string;
    createdAt?: string;
    runId?: string;
  }
) {
  const createdAt = input.createdAt ?? options.now().toISOString();
  const run = await options.repositories.runs.createFromPlan({
    id: input.runId ?? createPrefixedId(options.idFactory, "run"),
    outcomeId: input.outcome.id,
    planId: input.planId,
    triggerMessageId: input.triggerMessageId,
    createdAt,
    updatedAt: createdAt
  });

  await resolveAndPersistStepRoutes(options, {
    outcome: input.outcome,
    runId: run.id,
    resolvedAt: createdAt
  });

  const updatedOutcome = await options.repositories.outcomes.updateStatus({
    id: input.outcome.id,
    status: "queued",
    updatedAt: createdAt
  });

  if (!updatedOutcome) {
    throw new Error(`Failed to update outcome ${input.outcome.id} to queued.`);
  }

  const runDetail = await buildRunDetail(options.repositories, run.id);

  if (!runDetail) {
    throw new Error(`Failed to read persisted run ${run.id}.`);
  }

  options.eventBus.publish({
    outcomeId: input.outcome.id,
    type: "outcome.updated",
    data: OutcomeSchema.parse(updatedOutcome)
  });

  await publishInitialRunEvents(options, {
    outcomeId: input.outcome.id,
    run: runDetail
  });

  const useSimulatedExecution = isDevelopmentSimulationEnabled({
    simulationMode: options.simulationMode ?? false,
    outcomeSource: input.outcome.source
  });

  if (useSimulatedExecution) {
    options.simulatedExecutionService.startRun(runDetail.id);
  } else {
    options.executionService.startRun(runDetail.id);
  }

  return {
    outcome: OutcomeSchema.parse(updatedOutcome),
    run: runDetail
  };
}

export function createOutcomeTurnService(
  options: CreateOutcomeTurnServiceOptions
): OutcomeTurnService {
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? randomUUID;

  return {
    async startThread(input) {
      const createdOutcome = await options.repositories.outcomes.create({
        ...input,
        id: createPrefixedId(idFactory, "outcome")
      });
      const triggerMessage = {
        id: createPrefixedId(idFactory, "msg"),
        outcomeId: createdOutcome.id,
        role: "user",
        content: input.prompt,
        createdAt: now().toISOString()
      } as const;

      await options.repositories.outcomes.appendMessage(triggerMessage);

      options.eventBus.publish({
        outcomeId: createdOutcome.id,
        type: "message.created",
        data: MessageCreatedDataSchema.parse(triggerMessage)
      });

      const plan = await persistDraftPlan(options, {
        outcome: createdOutcome,
        triggerMessage,
        prompt: input.prompt
      });
      const startedRun = await createQueuedRunFromPlan(
        {
          ...options,
          now,
          idFactory
        },
        {
          outcome: createdOutcome,
          planId: plan.id,
          triggerMessageId: triggerMessage.id,
          createdAt: triggerMessage.createdAt
        }
      );

      return OutcomeTurnResponseSchema.parse({
        outcome: startedRun.outcome,
        triggerMessage: MessageCreatedDataSchema.parse(triggerMessage),
        plan,
        run: startedRun.run
      });
    },
    async continueThread(input) {
      const outcome = await options.repositories.outcomes.getById(input.outcomeId);

      if (!outcome) {
        throw new Error(`Outcome ${input.outcomeId} not found.`);
      }

      const triggerMessage = {
        id: createPrefixedId(idFactory, "msg"),
        outcomeId: outcome.id,
        role: "user",
        content: input.content,
        createdAt: now().toISOString()
      } as const;

      await options.repositories.outcomes.appendMessage(triggerMessage);

      options.eventBus.publish({
        outcomeId: outcome.id,
        type: "message.created",
        data: MessageCreatedDataSchema.parse(triggerMessage)
      });

      const plan = await persistDraftPlan(options, {
        outcome,
        triggerMessage,
        prompt: input.content
      });
      const startedRun = await createQueuedRunFromPlan(
        {
          ...options,
          now,
          idFactory
        },
        {
          outcome,
          planId: plan.id,
          triggerMessageId: triggerMessage.id,
          createdAt: triggerMessage.createdAt
        }
      );

      return OutcomeTurnResponseSchema.parse({
        outcome: startedRun.outcome,
        triggerMessage: MessageCreatedDataSchema.parse(triggerMessage),
        plan,
        run: startedRun.run
      });
    }
  };
}
