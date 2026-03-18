import { and, eq } from "drizzle-orm";
import type {
  Schedule,
  ScheduleFireSummary
} from "@computer-oss/protocol";
import type { DatabaseClient } from "../client";
import {
  outcomeRuns,
  outcomes,
  scheduleFires,
  schedules,
  workspaces
} from "../schema";

type ScheduleRow = typeof schedules.$inferSelect;
type ScheduleFireRow = typeof scheduleFires.$inferSelect;

export type StoredSchedule = Schedule;
export type StoredScheduleFire = ScheduleFireSummary;

export type CreateScheduleInput = StoredSchedule;

export type UpdateScheduleInput = {
  id: string;
  title?: string;
  prompt?: string;
  status?: StoredSchedule["status"];
  trigger?: StoredSchedule["trigger"];
  outcomeMode?: StoredSchedule["outcomeMode"];
  dispatchMode?: StoredSchedule["dispatchMode"];
  nextFireAt?: string | null;
  lastFiredAt?: string | null;
  validationDiagnostics?: StoredSchedule["validationDiagnostics"];
  expectedUpdatedAt?: string;
  updatedAt: string;
};

export type RecordScheduleFireInput = StoredScheduleFire;

function workspaceName(id: string) {
  return `Workspace ${id}`;
}

function mapScheduleRow(row: ScheduleRow): StoredSchedule {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    prompt: row.prompt,
    status: row.status,
    trigger: row.trigger as StoredSchedule["trigger"],
    outcomeMode: row.outcomeMode,
    dispatchMode: row.dispatchMode,
    nextFireAt: row.nextFireAt?.toISOString() ?? null,
    lastFiredAt: row.lastFiredAt?.toISOString() ?? null,
    validationDiagnostics:
      row.validationDiagnostics as StoredSchedule["validationDiagnostics"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapScheduleFireRow(row: ScheduleFireRow): StoredScheduleFire {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    occurrenceKey: row.occurrenceKey,
    scheduledFor: row.scheduledFor.toISOString(),
    firedAt: row.firedAt?.toISOString() ?? null,
    status: row.status,
    outcomeId: row.outcomeId ?? null,
    runId: row.runId ?? null,
    errorMessage: row.errorMessage ?? null
  };
}

function compareSchedules(left: StoredSchedule, right: StoredSchedule) {
  const createdDelta =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareScheduleFires(left: StoredScheduleFire, right: StoredScheduleFire) {
  const scheduledDelta =
    new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime();

  if (scheduledDelta !== 0) {
    return scheduledDelta;
  }

  return left.id.localeCompare(right.id);
}

async function ensureWorkspace(db: DatabaseClient, workspaceId: string) {
  await db
    .insert(workspaces)
    .values({
      id: workspaceId,
      name: workspaceName(workspaceId)
    })
    .onConflictDoNothing();
}

export class ScheduleRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreateScheduleInput): Promise<StoredSchedule> {
    await ensureWorkspace(this.db, input.workspaceId);

    const [created] = await this.db
      .insert(schedules)
      .values({
        id: input.id,
        workspaceId: input.workspaceId,
        title: input.title,
        prompt: input.prompt,
        status: input.status,
        trigger: input.trigger,
        outcomeMode: input.outcomeMode,
        dispatchMode: input.dispatchMode,
        nextFireAt: input.nextFireAt ? new Date(input.nextFireAt) : null,
        lastFiredAt: input.lastFiredAt ? new Date(input.lastFiredAt) : null,
        validationDiagnostics: input.validationDiagnostics,
        createdAt: new Date(input.createdAt),
        updatedAt: new Date(input.updatedAt)
      })
      .returning();

    return mapScheduleRow(created);
  }

  async getById(id: string): Promise<StoredSchedule | null> {
    const rows = await this.db.select().from(schedules);
    const found = rows.find((row) => row.id === id);
    return found ? mapScheduleRow(found) : null;
  }

  async listByWorkspace(workspaceId: string): Promise<StoredSchedule[]> {
    const rows = await this.db.select().from(schedules);
    return rows
      .filter((row) => row.workspaceId === workspaceId)
      .map(mapScheduleRow)
      .sort(compareSchedules);
  }

  async listAll(): Promise<StoredSchedule[]> {
    const rows = await this.db.select().from(schedules);
    return rows.map(mapScheduleRow).sort(compareSchedules);
  }

  async update(input: UpdateScheduleInput): Promise<StoredSchedule | null> {
    const [updated] = await this.db
      .update(schedules)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.prompt !== undefined ? { prompt: input.prompt } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
        ...(input.outcomeMode !== undefined
          ? { outcomeMode: input.outcomeMode }
          : {}),
        ...(input.dispatchMode !== undefined
          ? { dispatchMode: input.dispatchMode }
          : {}),
        ...(input.nextFireAt !== undefined
          ? { nextFireAt: input.nextFireAt ? new Date(input.nextFireAt) : null }
          : {}),
        ...(input.lastFiredAt !== undefined
          ? { lastFiredAt: input.lastFiredAt ? new Date(input.lastFiredAt) : null }
          : {}),
        ...(input.validationDiagnostics !== undefined
          ? { validationDiagnostics: input.validationDiagnostics }
          : {}),
        updatedAt: new Date(input.updatedAt)
      })
      .where(
        input.expectedUpdatedAt
          ? and(
              eq(schedules.id, input.id),
              eq(schedules.updatedAt, new Date(input.expectedUpdatedAt))
            )
          : eq(schedules.id, input.id)
      )
      .returning();

    return updated ? mapScheduleRow(updated) : null;
  }

  async recordFire(input: RecordScheduleFireInput): Promise<StoredScheduleFire> {
    return this.db.transaction(async (transaction) => {
      const [existingRows, scheduleRows, outcomeRows, runRows] = await Promise.all([
        transaction.select().from(scheduleFires),
        transaction.select().from(schedules),
        transaction.select().from(outcomes),
        transaction.select().from(outcomeRuns)
      ]);
      const existing = existingRows.find(
        (row) =>
          row.scheduleId === input.scheduleId && row.occurrenceKey === input.occurrenceKey
      );

      if (existing) {
        return mapScheduleFireRow(existing);
      }

      const schedule = scheduleRows.find((row) => row.id === input.scheduleId);

      if (!schedule) {
        throw new Error(`Schedule ${input.scheduleId} does not exist.`);
      }

      const outcome =
        input.outcomeId === null
          ? null
          : outcomeRows.find((row) => row.id === input.outcomeId);

      if (input.outcomeId !== null && !outcome) {
        throw new Error(`Outcome ${input.outcomeId} does not exist.`);
      }

      if (outcome && outcome.workspaceId !== schedule.workspaceId) {
        throw new Error(
          `Outcome ${input.outcomeId} belongs to ${outcome.workspaceId}, not ${schedule.workspaceId}.`
        );
      }

      const run =
        input.runId === null ? null : runRows.find((row) => row.id === input.runId);

      if (input.runId !== null && !run) {
        throw new Error(`Run ${input.runId} does not exist.`);
      }

      if (run && input.outcomeId === null) {
        throw new Error(`Schedule fire ${input.id} cannot record run ${input.runId} without an outcome.`);
      }

      if (run && run.outcomeId !== input.outcomeId) {
        throw new Error(
          `Run ${input.runId} belongs to outcome ${run.outcomeId}, not ${input.outcomeId}.`
        );
      }

      const [created] = await transaction
        .insert(scheduleFires)
        .values({
          id: input.id,
          scheduleId: input.scheduleId,
          occurrenceKey: input.occurrenceKey,
          scheduledFor: new Date(input.scheduledFor),
          firedAt: input.firedAt ? new Date(input.firedAt) : null,
          status: input.status,
          outcomeId: input.outcomeId,
          runId: input.runId,
          errorMessage: input.errorMessage
        })
        .returning();

      if (input.status === "triggered") {
        await transaction
          .update(schedules)
          .set({
            lastFiredAt: input.firedAt
              ? new Date(input.firedAt)
              : new Date(input.scheduledFor),
            updatedAt: input.firedAt
              ? new Date(input.firedAt)
              : new Date(input.scheduledFor)
          })
          .where(eq(schedules.id, input.scheduleId))
          .returning();
      }

      return mapScheduleFireRow(created);
    });
  }

  async listFiresBySchedule(scheduleId: string): Promise<StoredScheduleFire[]> {
    const rows = await this.db.select().from(scheduleFires);
    return rows
      .filter((row) => row.scheduleId === scheduleId)
      .map(mapScheduleFireRow)
      .sort(compareScheduleFires);
  }

  async delete(id: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(schedules)
      .where(eq(schedules.id, id))
      .returning();

    return Boolean(deleted);
  }
}
