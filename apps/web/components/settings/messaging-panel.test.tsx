import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessagingConnection } from "@computer-oss/protocol";
import { MessagingPanel } from "./messaging-panel";

const fetchMock = vi.fn();

const slackConnection: MessagingConnection = {
  id: "connection_slack_1",
  workspaceId: "ws_default",
  channel: "slack",
  transport: "socket_mode",
  status: "connected",
  enabled: true,
  accountLabel: "Operations Slack",
  externalWorkspaceId: "T123456",
  externalWorkspaceLabel: "Mycelium Ops",
  connectedAt: "2026-03-18T12:00:00.000Z",
  lastInboundAt: "2026-03-18T14:00:00.000Z",
  lastOutboundAt: "2026-03-18T14:05:00.000Z",
  lastError: null,
  updatedAt: "2026-03-18T14:05:00.000Z"
};

const telegramConnection: MessagingConnection = {
  id: "connection_telegram_1",
  workspaceId: "ws_default",
  channel: "telegram",
  transport: "long_polling",
  status: "disabled",
  enabled: false,
  accountLabel: "Ops Bot",
  externalWorkspaceId: "bot:telegram_ops",
  externalWorkspaceLabel: "Mycelium Telegram Bot",
  connectedAt: null,
  lastInboundAt: null,
  lastOutboundAt: null,
  lastError: null,
  updatedAt: "2026-03-18T12:00:00.000Z"
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MessagingPanel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders Slack and Telegram connection state and saves Slack updates through the web proxy", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...slackConnection,
          accountLabel: "Primary Slack",
          updatedAt: "2026-03-18T15:00:00.000Z"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    render(
      <MessagingPanel
        workspaceId="ws_default"
        slackConnection={slackConnection}
        telegramConnection={telegramConnection}
      />
    );

    expect(screen.getByText("Slack")).toBeInTheDocument();
    expect(screen.getByText("Telegram")).toBeInTheDocument();
    expect(screen.getByText("connected")).toBeInTheDocument();
    expect(screen.getByText("disabled")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/slack account label/i), {
      target: { value: "Primary Slack" }
    });
    fireEvent.click(screen.getByRole("button", { name: /save slack connection/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/slack");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toMatchObject({
      workspaceId: "ws_default",
      enabled: true,
      accountLabel: "Primary Slack",
      externalWorkspaceId: "T123456",
      externalWorkspaceLabel: "Mycelium Ops"
    });

    expect(await screen.findByText("Slack connection saved.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Primary Slack")).toBeInTheDocument();
  });
});
