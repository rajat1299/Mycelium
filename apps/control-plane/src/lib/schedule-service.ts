import { createHash, randomUUID } from "node:crypto";
import { createDeterministicDraftPlan, validatePlanGraph } from "@computer-oss/orchestrator";
import {
  CapabilityFamilySchema,
  PlanSchema,
  RunSchema,
  RunStepSchema,
  ScheduleFireSummarySchema,
  ScheduleSchema,
  type Schedule,
  type ScheduleDispatchMode,
  type ScheduleFireSummary,
  type ScheduleTrigger,
  type ScheduleValidationDiagnostic
} from "@computer-oss/protocol";
import { CronExpressionParser } from "cron-parser";
import type { EventBus } from "./event-bus";
import type { ExecutionService } from "./execution-service";
import type { Repositories } from "./repositories";
import type { RouterService } from "./router-service";

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const MIN_POLL_INTERVAL_MS = 5_000;

type ScheduleServiceOptions = {
  repositories: Repositories;
  eventBus: EventBus;
  executionService: ExecutionService;
  routerService: RouterService;
  pollIntervalMs?: number;
  now?: () => Date;
};

type CreateScheduleRequest = {
  workspaceId: string;
  title: string;
  prompt: string;
  status: Schedule["status"];
  trigger: ScheduleTrigger;
  outcomeMode: Schedule["outcomeMode"];
  dispatchMode: ScheduleDispatchMode;
};

type UpdateScheduleRequest = {
  title?: string;
  prompt?: string;
  status?: Schedule["status"];
  trigger?: ScheduleTrigger;
  outcomeMode?: Schedule["outcomeMode"];
  dispatchMode?: ScheduleDispatchMode;
};

export type ScheduleService = {
  start(): Promise<void>;
  close(): void;
  createSchedule(input: CreateScheduleRequest): Promise<Schedule>;
  getSchedule(id: string): Promise<Schedule | null>;
  listSchedules(workspaceId: string): Promise<Schedule[]>;
  updateSchedule(id: string, input: UpdateScheduleRequest): Promise<Schedule | null>;
  deleteSchedule(id: string): Promise<boolean>;
  listScheduleFires(id: string): Promise<ScheduleFireSummary[]>;
  processDueSchedules(reason: string): Promise<void>;
};

function normalizePollIntervalMs(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) {
    return DEFAULT_POLL_INTERVAL_MS;
  }

  return Math.max(MIN_POLL_INTERVAL_MS, Math.floor(value));
}

function buildOccurrenceKey(scheduleId: string, scheduledFor: string) {
  return `${scheduleId}:${scheduledFor}`;
}

function deterministicId(prefix: string, seed: string) {
  const suffix = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  return `${prefix}_${suffix}`;
}

function compareSchedulesByFireTime(left: Schedule, right: Schedule) {
  const leftTime = left.nextFireAt ? new Date(left.nextFireAt).getTime() : Number.MAX_SAFE_INTEGER;
  const rightTime = right.nextFireAt ? new Date(right.nextFireAt).getTime() : Number.MAX_SAFE_INTEGER;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.id.localeCompare(right.id);
}

function validationDiagnosticsForTrigger(
  trigger: ScheduleTrigger
): ScheduleValidationDiagnostic[] {
  if (trigger.kind !== "cron") {
    return [];
  }

  try {
    CronExpressionParser.parse(trigger.expression, {
      tz: trigger.timezone
    });
    return [];
  } catch (error) {
    return [
      {
        code: "invalid_cron_expression",
        message: error instanceof Error ? error.message : String(error),
        severity: "error",
        field: "trigger.expression"
      }
    ];
  }
}

function computeEveryNextFireAt(trigger: Extract<ScheduleTrigger, { kind: "every" }>, reference: Date) {
  const anchor = trigger.anchorAt ? new Date(trigger.anchorAt) : reference;

  if (anchor.getTime() >= reference.getTime()) {
    return anchor.toISOString();
  }

  const elapsedMs = reference.getTime() - anchor.getTime();
  const intervalsElapsed = Math.floor(elapsedMs / trigger.everyMs) + 1;

  return new Date(anchor.getTime() + intervalsElapsed * trigger.everyMs).toISOString();
}

function computeNextFireAt(trigger: ScheduleTrigger, reference: Date): string | null {
  if (trigger.kind === "at") {
    return new Date(trigger.at).getTime() >= reference.getTime() ? trigger.at : null;
  }

  if (trigger.kind === "every") {
    return computeEveryNextFireAt(trigger, reference);
  }

  const iterator = CronExpressionParser.parse(trigger.expression, {
    currentDate: reference,
    tz: trigger.timezone
  });

  return iterator.next().toDate().toISOString();
}

function computeNextFireAfterRun(schedule: Schedule, scheduledFor: string): string | null {
  const firedAt = new Date(scheduledFor);

  if (schedule.trigger.kind === "at") {
    return null;
  }

  if (schedule.trigger.kind === "every") {
    return computeEveryNextFireAt(
      schedule.trigger,
      new Date(firedAt.getTime() + 1)
    );
  }

  const iterator = CronExpressionParser.parse(schedule.trigger.expression, {
    currentDate: new Date(firedAt.getTime() + 1),
    tz: schedule.trigger.timezone
  });

  return iterator.next().toDate().toISOString();
}

function deriveScheduleState(
  current: Pick<
    Schedule,
    "status" | "trigger" | "title" | "prompt" | "outcomeMode" | "dispatchMode"
  >,
  input: {
    status?: Schedule["status"];
    trigger?: ScheduleTrigger;
    title?: string;
    prompt?: string;
    outcomeMode?: Schedule["outcomeMode"];
    dispatchMode?: Schedule["dispatchMode"];
  },
  now: Date
) {
  const trigger = input.trigger ?? current.trigger;
  const diagnostics = validationDiagnosticsForTrigger(trigger);
  const requestedStatus = input.status ?? current.status;
  const status =
    requestedStatus === "disabled" || requestedStatus === "paused"
      ? requestedStatus
      : diagnostics.some((diagnostic) => diagnostic.severity === "error")
        ? "error"
        : requestedStatus;
  const nextFireAt =
    status === "active" ? computeNextFireAt(trigger, now) : null;

  return {
    title: input.title ?? current.title,
    prompt: input.prompt ?? current.prompt,
    status,
    trigger,
    outcomeMode: input.outcomeMode ?? current.outcomeMode,
    dispatchMode: input.dispatchMode ?? current.dispatchMode,
    validationDiagnostics: diagnostics,
    nextFireAt
  };
}

async function resolveAndPersistStepRoutes(
  options: Pick<ScheduleServiceOptions, "repositories" | "routerService">,
  input: {
    workspaceId: string;
    runId: string;
    resolvedAt: string;
  }
) {
  const steps = await options.repositories.runs.listSteps(input.runId);

  await Promise.all(
    steps.map(async (step) => {
      const route = await options.routerService.resolveRoute({
        workspaceId: input.workspaceId,
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

export function createScheduleService(
  options: ScheduleServiceOptions
): ScheduleService {
  const now = options.now ?? (() => new Date());
  const pollIntervalMs = normalizePollIntervalMs(options.pollIntervalMs);
  let running = false;
  let processing = false;
  let pendingProcess = false;
  let pollTimer: NodeJS.Timeout | undefined;
  let activeRunPromise: Promise<void> | undefined;

  async function createOutcomeIfMissing(
    schedule: Schedule,
    occurrenceKey: string
  ) {
    if (schedule.outcomeMode === "continue_outcome") {
      const previousFires = await options.repositories.schedules.listFiresBySchedule(
        schedule.id
      );
      const latestOutcomeFire = [...previousFires]
        .reverse()
        .find((fire) => fire.status === "triggered" && fire.outcomeId);

      if (latestOutcomeFire?.outcomeId) {
        const existingOutcome = await options.repositories.outcomes.getById(
          latestOutcomeFire.outcomeId
        );

        if (existingOutcome) {
          return { outcome: existingOutcome, created: false };
        }
      }
    }

    const outcomeId = deterministicId("outcome", occurrenceKey);

    try {
      const created = await options.repositories.outcomes.create({
        id: outcomeId,
        workspaceId: schedule.workspaceId,
        userId: `schedule_user_${schedule.workspaceId}`,
        prompt: schedule.prompt,
        source: "schedule"
      });

      options.eventBus.publish({
        outcomeId: created.id,
        type: "outcome.updated",
        data: created
      });

      return { outcome: created, created: true };
    } catch (error) {
      if (error instanceof Error && error.message.includes("duplicate")) {
        const existing = await options.repositories.outcomes.getById(outcomeId);

        if (existing) {
          return { outcome: existing, created: false };
        }
      }

      throw error;
    }
  }

  async function createPlanIfMissing(outcomeId: string, prompt: string, createdAt: string) {
    const existing = await options.repositories.plans.getByOutcome(outcomeId);

    if (existing) {
      return { plan: existing, created: false };
    }

    const draftPlan = createDeterministicDraftPlan({
      outcomeId,
      prompt,
      createdAt,
      updatedAt: createdAt
    });
    const validation = validatePlanGraph(draftPlan);

    if (!validation.ok) {
      throw new Error(`Generated plan is invalid: ${validation.errors.join("; ")}`);
    }

    try {
      const created = await options.repositories.plans.create({
        id: draftPlan.id,
        outcomeId: draftPlan.outcomeId,
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

      const [nodes, edges] = await Promise.all([
        options.repositories.plans.listNodes(created.id),
        options.repositories.plans.listEdges(created.id)
      ]);

      options.eventBus.publish({
        outcomeId,
        type: "plan.created",
        data: PlanSchema.parse({
          ...created,
          nodes,
          edges
        })
      });

      return { plan: created, created: true };
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        const plan = await options.repositories.plans.getByOutcome(outcomeId);

        if (plan) {
          return { plan, created: false };
        }
      }

      throw error;
    }
  }

  async function createRunIfMissing(input: {
    occurrenceKey: string;
    outcomeId: string;
    workspaceId: string;
    planId: string;
    createdAt: string;
  }) {
    const runId = deterministicId("run", input.occurrenceKey);

    try {
      const run = await options.repositories.runs.createFromPlan({
        id: runId,
        outcomeId: input.outcomeId,
        planId: input.planId,
        createdAt: input.createdAt,
        updatedAt: input.createdAt
      });

      await resolveAndPersistStepRoutes(options, {
        workspaceId: input.workspaceId,
        runId: run.id,
        resolvedAt: input.createdAt
      });

      const updatedOutcome = await options.repositories.outcomes.updateStatus({
        id: input.outcomeId,
        status: "queued",
        updatedAt: input.createdAt
      });

      if (updatedOutcome) {
        options.eventBus.publish({
          outcomeId: input.outcomeId,
          type: "outcome.updated",
          data: updatedOutcome
        });
      }

      const runEventData = RunSchema.parse(run);

      await options.repositories.runs.appendEvent({
        id: `event_${randomUUID()}`,
        runId: run.id,
        eventType: "run.created",
        payload: runEventData,
        createdAt: input.createdAt
      });

      options.eventBus.publish({
        outcomeId: input.outcomeId,
        type: "run.created",
        data: runEventData
      });

      const steps = await options.repositories.runs.listSteps(run.id);

      for (const step of steps) {
        const stepEventData = RunStepSchema.parse(step);

        await options.repositories.runs.appendEvent({
          id: `event_${randomUUID()}`,
          runId: run.id,
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

      options.executionService.startRun(run.id);

      return { run, created: true };
    } catch (error) {
      if (error instanceof Error && error.message.includes("duplicate")) {
        const existing = await options.repositories.runs.getById(runId);

        if (existing) {
          return { run: existing, created: false };
        }
      }

      throw error;
    }
  }

  async function processDueSchedule(schedule: Schedule) {
    if (!schedule.nextFireAt) {
      return;
    }

    const occurrenceKey = buildOccurrenceKey(schedule.id, schedule.nextFireAt);
    const firedAt = now().toISOString();

    try {
      const { outcome } = await createOutcomeIfMissing(schedule, occurrenceKey);
      let runId: string | null = null;

      if (schedule.dispatchMode === "outcome_only") {
        const updatedOutcome = await options.repositories.outcomes.updateStatus({
          id: outcome.id,
          status: "scheduled",
          updatedAt: firedAt
        });

        if (updatedOutcome) {
          options.eventBus.publish({
            outcomeId: outcome.id,
            type: "outcome.updated",
            data: updatedOutcome
          });
        }
      }

      if (
        schedule.dispatchMode === "draft_plan" ||
        schedule.dispatchMode === "create_run"
      ) {
        const { plan } = await createPlanIfMissing(
          outcome.id,
          outcome.prompt,
          firedAt
        );

        if (schedule.dispatchMode === "draft_plan") {
          const updatedOutcome = await options.repositories.outcomes.updateStatus({
            id: outcome.id,
            status: "planning",
            updatedAt: firedAt
          });

          if (updatedOutcome) {
            options.eventBus.publish({
              outcomeId: outcome.id,
              type: "outcome.updated",
              data: updatedOutcome
            });
          }
        }

        if (schedule.dispatchMode === "create_run") {
          const { run } = await createRunIfMissing({
            occurrenceKey,
            outcomeId: outcome.id,
            workspaceId: outcome.workspaceId,
            planId: plan.id,
            createdAt: firedAt
          });

          runId = run.id;
        }
      }

      const fire = ScheduleFireSummarySchema.parse(
        await options.repositories.schedules.recordFire({
          id: deterministicId("schedule_fire", occurrenceKey),
          scheduleId: schedule.id,
          occurrenceKey,
          scheduledFor: schedule.nextFireAt,
          firedAt,
          status: "triggered",
          outcomeId: outcome.id,
          runId,
          errorMessage: null
        })
      );
      const updatedSchedule = await options.repositories.schedules.update({
        id: schedule.id,
        status: schedule.status,
        lastFiredAt: fire.firedAt,
        nextFireAt: computeNextFireAfterRun(schedule, schedule.nextFireAt),
        updatedAt: firedAt
      });

      if (updatedSchedule) {
        options.eventBus.publish({
          outcomeId: outcome.id,
          type: "schedule.updated",
          data: ScheduleSchema.parse(updatedSchedule)
        });
      }

      options.eventBus.publish({
        outcomeId: outcome.id,
        type: "schedule.fired",
        data: fire
      });
    } catch (error) {
      await options.repositories.schedules.recordFire({
        id: deterministicId("schedule_fire", occurrenceKey),
        scheduleId: schedule.id,
        occurrenceKey,
        scheduledFor: schedule.nextFireAt,
        firedAt,
        status: "failed",
        outcomeId: null,
        runId: null,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function processDueSchedulesInternal(_reason: string) {
    const currentNow = now();
    const schedules = (await options.repositories.schedules.listAll())
      .filter(
        (schedule) =>
          schedule.status === "active" &&
          schedule.nextFireAt !== null &&
          new Date(schedule.nextFireAt).getTime() <= currentNow.getTime()
      )
      .sort(compareSchedulesByFireTime);

    for (const schedule of schedules) {
      await processDueSchedule(schedule);
    }
  }

  async function processDueSchedules(reason: string) {
    if (processing) {
      pendingProcess = true;
      return activeRunPromise ?? Promise.resolve();
    }

    processing = true;
    const run = processDueSchedulesInternal(reason).finally(() => {
      processing = false;

      if (pendingProcess) {
        pendingProcess = false;
        void processDueSchedules("pending");
      }
    });

    activeRunPromise = run.finally(() => {
      if (activeRunPromise === run) {
        activeRunPromise = undefined;
      }
    });

    return activeRunPromise;
  }

  return {
    async start() {
      if (running) {
        return;
      }

      running = true;
      await processDueSchedules("startup");
      pollTimer = setInterval(() => {
        void processDueSchedules("poll");
      }, pollIntervalMs);
      pollTimer.unref?.();
    },
    close() {
      running = false;

      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    },
    async createSchedule(input) {
      const timestamp = now();
      const derived = deriveScheduleState(
        {
          title: input.title,
          prompt: input.prompt,
          status: input.status,
          trigger: input.trigger,
          outcomeMode: input.outcomeMode,
          dispatchMode: input.dispatchMode
        },
        input,
        timestamp
      );

      return options.repositories.schedules.create({
        id: `schedule_${randomUUID()}`,
        workspaceId: input.workspaceId,
        title: derived.title,
        prompt: derived.prompt,
        status: derived.status,
        trigger: derived.trigger,
        outcomeMode: derived.outcomeMode,
        dispatchMode: derived.dispatchMode,
        nextFireAt: derived.nextFireAt,
        lastFiredAt: null,
        validationDiagnostics: derived.validationDiagnostics,
        createdAt: timestamp.toISOString(),
        updatedAt: timestamp.toISOString()
      });
    },
    async getSchedule(id) {
      return options.repositories.schedules.getById(id);
    },
    async listSchedules(workspaceId) {
      return options.repositories.schedules.listByWorkspace(workspaceId);
    },
    async updateSchedule(id, input) {
      const existing = await options.repositories.schedules.getById(id);

      if (!existing) {
        return null;
      }

      const derived = deriveScheduleState(existing, input, now());

      return options.repositories.schedules.update({
        id,
        title: derived.title,
        prompt: derived.prompt,
        status: derived.status,
        trigger: derived.trigger,
        outcomeMode: derived.outcomeMode,
        dispatchMode: derived.dispatchMode,
        nextFireAt: derived.nextFireAt,
        validationDiagnostics: derived.validationDiagnostics,
        updatedAt: now().toISOString()
      });
    },
    async deleteSchedule(id) {
      return options.repositories.schedules.delete(id);
    },
    async listScheduleFires(id) {
      return options.repositories.schedules.listFiresBySchedule(id);
    },
    processDueSchedules
  };
}
