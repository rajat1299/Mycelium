import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Schedule } from "@computer-oss/protocol";
import { SchedulesPanel } from "./schedules-panel";

const fetchMock = vi.fn();

const schedules: Schedule[] = [
  {
    id: "schedule_morning_brief",
    workspaceId: "ws_default",
    title: "Morning brief",
    prompt: "Draft the morning operations brief.",
    status: "active",
    trigger: {
      kind: "cron",
      expression: "0 9 * * 1-5",
      timezone: "America/Chicago"
    },
    outcomeMode: "create_outcome",
    dispatchMode: "create_run",
    nextFireAt: "2026-03-19T14:00:00.000Z",
    lastFiredAt: "2026-03-18T14:00:00.000Z",
    validationDiagnostics: [],
    createdAt: "2026-03-18T00:00:00.000Z",
    updatedAt: "2026-03-18T14:00:00.000Z"
  }
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SchedulesPanel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders schedule state and creates a new schedule through the web proxy", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "schedule_evening_recap",
          workspaceId: "ws_default",
          title: "Evening recap",
          prompt: "Summarize the day and flag open issues.",
          status: "active",
          trigger: {
            kind: "cron",
            expression: "0 17 * * 1-5",
            timezone: "America/Chicago"
          },
          outcomeMode: "create_outcome",
          dispatchMode: "draft_plan",
          nextFireAt: "2026-03-19T22:00:00.000Z",
          lastFiredAt: null,
          validationDiagnostics: [],
          createdAt: "2026-03-18T15:00:00.000Z",
          updatedAt: "2026-03-18T15:00:00.000Z"
        }),
        {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    render(<SchedulesPanel workspaceId="ws_default" schedules={schedules} />);

    expect(screen.getByText("Morning brief")).toBeInTheDocument();
    expect(screen.getByText("0 9 * * 1-5")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/schedule title/i), {
      target: { value: "Evening recap" }
    });
    fireEvent.change(screen.getByLabelText(/schedule prompt/i), {
      target: { value: "Summarize the day and flag open issues." }
    });
    fireEvent.change(screen.getByLabelText(/cron expression/i), {
      target: { value: "0 17 * * 1-5" }
    });
    fireEvent.change(screen.getByLabelText(/schedule timezone/i), {
      target: { value: "America/Chicago" }
    });
    fireEvent.change(screen.getByLabelText(/schedule dispatch mode/i), {
      target: { value: "draft_plan" }
    });
    fireEvent.click(screen.getByRole("button", { name: /create schedule/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/schedules");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      workspaceId: "ws_default",
      title: "Evening recap",
      prompt: "Summarize the day and flag open issues.",
      outcomeMode: "create_outcome",
      dispatchMode: "draft_plan",
      trigger: {
        kind: "cron",
        expression: "0 17 * * 1-5",
        timezone: "America/Chicago"
      }
    });

    expect(await screen.findByText("Schedule created.")).toBeInTheDocument();
    expect(screen.getByText("Evening recap")).toBeInTheDocument();
  });

  it("updates an existing schedule status through the web proxy", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...schedules[0],
          status: "paused",
          updatedAt: "2026-03-18T16:00:00.000Z"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    render(<SchedulesPanel workspaceId="ws_default" schedules={schedules} />);

    fireEvent.click(screen.getByRole("button", { name: /pause morning brief/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/schedules");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toMatchObject({
      workspaceId: "ws_default",
      scheduleId: "schedule_morning_brief",
      status: "paused"
    });

    expect(await screen.findByText("Schedule updated.")).toBeInTheDocument();
    expect(screen.getByText("paused")).toBeInTheDocument();
  });
});
