"use client";

import { useEffect, useState } from "react";
import { ScheduleSchema, type Schedule } from "@computer-oss/protocol";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

type SchedulesPanelProps = {
  workspaceId: string;
  schedules: Schedule[];
};

type StatusMessage = {
  tone: "default" | "error";
  text: string;
} | null;

function readErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

function sortSchedules(items: Schedule[]) {
  return [...items].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt.localeCompare(left.updatedAt);
    }

    return left.title.localeCompare(right.title);
  });
}

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not scheduled";
}

function badgeVariant(status: Schedule["status"]) {
  switch (status) {
    case "active":
      return "emerald";
    case "paused":
    case "error":
      return "amber";
    default:
      return "slate";
  }
}

function formatTriggerSummary(trigger: Schedule["trigger"]) {
  switch (trigger.kind) {
    case "cron":
      return {
        primary: trigger.expression,
        secondary: trigger.timezone
      };
    case "every":
      return {
        primary: `Every ${Math.round(trigger.everyMs / 60000)} min`,
        secondary: trigger.timezone ?? trigger.anchorAt ?? "Interval schedule"
      };
    case "at":
      return {
        primary: new Date(trigger.at).toLocaleString(),
        secondary: trigger.timezone ?? "One-time schedule"
      };
  }
}

function scheduleModeLabel(
  outcomeMode: Schedule["outcomeMode"],
  dispatchMode: Schedule["dispatchMode"]
) {
  return outcomeMode === "continue_outcome"
    ? `Continue outcome · ${dispatchMode.replace("_", " ")}`
    : `Create outcome · ${dispatchMode.replace("_", " ")}`;
}

export function SchedulesPanel({ workspaceId, schedules }: SchedulesPanelProps) {
  const [scheduleState, setScheduleState] = useState(() => sortSchedules(schedules));
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cronExpression, setCronExpression] = useState("0 9 * * 1-5");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [outcomeMode, setOutcomeMode] = useState<Schedule["outcomeMode"]>(
    "create_outcome"
  );
  const [dispatchMode, setDispatchMode] = useState<Schedule["dispatchMode"]>(
    "create_run"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);

  useEffect(() => {
    setScheduleState(sortSchedules(schedules));
  }, [schedules]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !prompt.trim() || !cronExpression.trim() || !timezone.trim()) {
      setStatusMessage({
        tone: "error",
        text: "Title, prompt, cron expression, and timezone are required."
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          workspaceId,
          title: title.trim(),
          prompt: prompt.trim(),
          status: "active",
          trigger: {
            kind: "cron",
            expression: cronExpression.trim(),
            timezone: timezone.trim()
          },
          outcomeMode,
          dispatchMode
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Unable to create schedule."));
      }

      const created = ScheduleSchema.parse(payload);
      setScheduleState((current) =>
        sortSchedules([created, ...current.filter((item) => item.id !== created.id)])
      );
      setTitle("");
      setPrompt("");
      setStatusMessage({
        tone: "default",
        text: "Schedule created."
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to create schedule."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateScheduleStatus(schedule: Schedule, nextStatus: Schedule["status"]) {
    setStatusMessage(null);

    try {
      const response = await fetch("/api/schedules", {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          workspaceId,
          scheduleId: schedule.id,
          status: nextStatus
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Unable to update schedule."));
      }

      const updated = ScheduleSchema.parse(payload);
      setScheduleState((current) =>
        sortSchedules(current.map((item) => (item.id === updated.id ? updated : item)))
      );
      setStatusMessage({
        tone: "default",
        text: "Schedule updated."
      });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to update schedule."
      });
    }
  }

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Schedules
          </p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight text-ink">
            Durable triggers
          </h2>
        </div>
        <Badge variant="slate">{scheduleState.length} schedules</Badge>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted">
        Create durable schedule entries that reuse the same outcome, plan, and run
        pipeline as manual work.
      </p>

      <Card className="mt-6 overflow-hidden">
        <CardHeader className="border-b border-panel-line/70 bg-[linear-gradient(135deg,rgba(13,139,123,0.08),rgba(15,111,120,0.03))]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Compose a new schedule</CardTitle>
              <CardDescription>
                Keep the ingress surface minimal: title, prompt, cadence, and how the
                outcome should dispatch.
              </CardDescription>
            </div>
            <Badge variant="sky">cron</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={handleCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="schedule-title">Schedule title</Label>
              <Input
                id="schedule-title"
                aria-label="Schedule title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Morning brief"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="schedule-prompt">Schedule prompt</Label>
              <Textarea
                id="schedule-prompt"
                aria-label="Schedule prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                placeholder="Draft the morning operations brief."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="schedule-cron">Cron expression</Label>
                <Input
                  id="schedule-cron"
                  aria-label="Cron expression"
                  value={cronExpression}
                  onChange={(event) => setCronExpression(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="schedule-timezone">Schedule timezone</Label>
                <Input
                  id="schedule-timezone"
                  aria-label="Schedule timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="schedule-outcome-mode">Schedule outcome mode</Label>
                <select
                  id="schedule-outcome-mode"
                  aria-label="Schedule outcome mode"
                  value={outcomeMode}
                  onChange={(event) =>
                    setOutcomeMode(event.target.value as Schedule["outcomeMode"])
                  }
                  className="w-full rounded-[1rem] border border-panel-line bg-white/88 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                >
                  <option value="create_outcome">Create outcome</option>
                  <option value="continue_outcome">Continue latest outcome</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="schedule-dispatch-mode">Schedule dispatch mode</Label>
                <select
                  id="schedule-dispatch-mode"
                  aria-label="Schedule dispatch mode"
                  value={dispatchMode}
                  onChange={(event) =>
                    setDispatchMode(event.target.value as Schedule["dispatchMode"])
                  }
                  className="w-full rounded-[1rem] border border-panel-line bg-white/88 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                >
                  <option value="create_run">Create run</option>
                  <option value="draft_plan">Draft plan only</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs leading-5 text-muted">
                Schedules enter the same durable control-plane path as web-triggered
                work. They are not a sidecar automation system.
              </p>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating schedule" : "Create schedule"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {statusMessage ? (
        <p
          className={[
            "mt-4 text-sm leading-6",
            statusMessage.tone === "error" ? "text-amber-900" : "text-muted"
          ].join(" ")}
        >
          {statusMessage.text}
        </p>
      ) : null}

      {scheduleState.length === 0 ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-panel-line bg-white/60 p-6 text-sm leading-6 text-muted">
          No schedules are configured for this workspace yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {scheduleState.map((schedule) => {
            const nextStatus = schedule.status === "active" ? "paused" : "active";
            const triggerSummary = formatTriggerSummary(schedule.trigger);

            return (
              <Card key={schedule.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{schedule.title}</CardTitle>
                      <CardDescription>{schedule.prompt}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={badgeVariant(schedule.status)} size="sm">
                        {schedule.status}
                      </Badge>
                      <Badge variant="slate" size="sm">
                        {scheduleModeLabel(schedule.outcomeMode, schedule.dispatchMode)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-muted md:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-panel-line/70 bg-panel/55 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Trigger
                    </p>
                    <p className="mt-2 font-medium text-ink">
                      {triggerSummary.primary}
                    </p>
                    <p className="mt-1">{triggerSummary.secondary}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-panel-line/70 bg-panel/55 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Runtime
                    </p>
                    <p className="mt-2">Next fire: {formatTimestamp(schedule.nextFireAt)}</p>
                    <p className="mt-1">Last fire: {formatTimestamp(schedule.lastFiredAt)}</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <p className="text-xs leading-5 text-muted">
                    Updated {new Date(schedule.updatedAt).toLocaleString()}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => updateScheduleStatus(schedule, nextStatus)}
                    aria-label={`${
                      nextStatus === "paused" ? "Pause" : "Activate"
                    } ${schedule.title}`}
                  >
                    {nextStatus === "paused" ? "Pause" : "Activate"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
