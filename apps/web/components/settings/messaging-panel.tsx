"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MessagingConnectionSchema,
  type MessagingChannel,
  type MessagingConnection
} from "@computer-oss/protocol";
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

type MessagingPanelProps = {
  workspaceId: string;
  slackConnection: MessagingConnection | null;
  telegramConnection: MessagingConnection | null;
};

type ConnectionDraft = {
  enabled: boolean;
  accountLabel: string;
  externalWorkspaceId: string;
  externalWorkspaceLabel: string;
};

type StatusMessage = {
  tone: "default" | "error";
  text: string;
} | null;

const EMPTY_DRAFT: ConnectionDraft = {
  enabled: false,
  accountLabel: "",
  externalWorkspaceId: "",
  externalWorkspaceLabel: ""
};

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

function draftFromConnection(connection: MessagingConnection | null): ConnectionDraft {
  return connection
    ? {
        enabled: connection.enabled,
        accountLabel: connection.accountLabel,
        externalWorkspaceId: connection.externalWorkspaceId,
        externalWorkspaceLabel: connection.externalWorkspaceLabel ?? ""
      }
    : EMPTY_DRAFT;
}

function badgeVariant(status: MessagingConnection["status"] | "missing") {
  switch (status) {
    case "connected":
      return "emerald";
    case "error":
    case "degraded":
      return "amber";
    default:
      return "slate";
  }
}

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not seen yet";
}

function transportLabel(channel: MessagingChannel, connection: MessagingConnection | null) {
  return connection?.transport ?? (channel === "slack" ? "socket_mode" : "long_polling");
}

export function MessagingPanel({
  workspaceId,
  slackConnection,
  telegramConnection
}: MessagingPanelProps) {
  const initialConnections = useMemo(
    () => ({
      slack: slackConnection,
      telegram: telegramConnection
    }),
    [slackConnection, telegramConnection]
  );
  const [connections, setConnections] = useState(initialConnections);
  const [drafts, setDrafts] = useState<Record<MessagingChannel, ConnectionDraft>>({
    slack: draftFromConnection(slackConnection),
    telegram: draftFromConnection(telegramConnection)
  });
  const [submittingChannel, setSubmittingChannel] = useState<MessagingChannel | null>(
    null
  );
  const [statusMessages, setStatusMessages] = useState<
    Record<MessagingChannel, StatusMessage>
  >({
    slack: null,
    telegram: null
  });

  useEffect(() => {
    setConnections(initialConnections);
    setDrafts({
      slack: draftFromConnection(slackConnection),
      telegram: draftFromConnection(telegramConnection)
    });
  }, [initialConnections, slackConnection, telegramConnection]);

  async function saveConnection(channel: MessagingChannel) {
    const draft = drafts[channel];

    if (!draft.accountLabel.trim() || !draft.externalWorkspaceId.trim()) {
      setStatusMessages((current) => ({
        ...current,
        [channel]: {
          tone: "error",
          text: `${channel === "slack" ? "Slack" : "Telegram"} account label and external workspace id are required.`
        }
      }));
      return;
    }

    setSubmittingChannel(channel);
    setStatusMessages((current) => ({
      ...current,
      [channel]: null
    }));

    try {
      const response = await fetch(`/api/${channel}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          workspaceId,
          enabled: draft.enabled,
          accountLabel: draft.accountLabel.trim(),
          externalWorkspaceId: draft.externalWorkspaceId.trim(),
          externalWorkspaceLabel: draft.externalWorkspaceLabel.trim() || null
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          readErrorMessage(payload, `Unable to save ${channel} connection.`)
        );
      }

      const connection = MessagingConnectionSchema.parse(payload);
      setConnections((current) => ({
        ...current,
        [channel]: connection
      }));
      setDrafts((current) => ({
        ...current,
        [channel]: draftFromConnection(connection)
      }));
      setStatusMessages((current) => ({
        ...current,
        [channel]: {
          tone: "default",
          text: `${channel === "slack" ? "Slack" : "Telegram"} connection saved.`
        }
      }));
    } catch (error) {
      setStatusMessages((current) => ({
        ...current,
        [channel]: {
          tone: "error",
          text:
            error instanceof Error
              ? error.message
              : `Unable to save ${channel} connection.`
        }
      }));
    } finally {
      setSubmittingChannel(null);
    }
  }

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Messaging
          </p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight text-ink">
            Channel connections
          </h2>
        </div>
        <Badge variant="slate">
          {[connections.slack, connections.telegram].filter(Boolean).length} configured
        </Badge>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted">
        Slack stays on Socket Mode and Telegram stays on long polling in M8. The
        control plane remains authoritative for all durable messaging state.
      </p>

      <div className="mt-6 grid gap-4">
        {(["slack", "telegram"] as const).map((channel) => {
          const connection = connections[channel];
          const draft = drafts[channel];
          const channelLabel = channel === "slack" ? "Slack" : "Telegram";
          const status = connection?.status ?? "missing";

          return (
            <Card key={channel} className="overflow-hidden">
              <CardHeader className="border-b border-panel-line/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.76),rgba(242,223,191,0.26))]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{channelLabel}</CardTitle>
                    <CardDescription>
                      {channel === "slack"
                        ? "Socket Mode ingress with durable conversation binding."
                        : "Long polling ingress with durable chat continuation."}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={badgeVariant(status)} size="sm">
                      {connection?.status ?? "disabled"}
                    </Badge>
                    <Badge variant="slate" size="sm">
                      {transportLabel(channel, connection)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor={`${channel}-account-label`}>
                      {channelLabel} account label
                    </Label>
                    <Input
                      id={`${channel}-account-label`}
                      aria-label={`${channelLabel} account label`}
                      value={draft.accountLabel}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [channel]: {
                            ...current[channel],
                            accountLabel: event.target.value
                          }
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`${channel}-external-workspace-id`}>
                      {channelLabel} external workspace id
                    </Label>
                    <Input
                      id={`${channel}-external-workspace-id`}
                      aria-label={`${channelLabel} external workspace id`}
                      value={draft.externalWorkspaceId}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [channel]: {
                            ...current[channel],
                            externalWorkspaceId: event.target.value
                          }
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[1.4fr_0.6fr]">
                  <div className="grid gap-2">
                    <Label htmlFor={`${channel}-external-workspace-label`}>
                      {channelLabel} external workspace label
                    </Label>
                    <Input
                      id={`${channel}-external-workspace-label`}
                      aria-label={`${channelLabel} external workspace label`}
                      value={draft.externalWorkspaceLabel}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [channel]: {
                            ...current[channel],
                            externalWorkspaceLabel: event.target.value
                          }
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`${channel}-enabled`}>{channelLabel} enabled</Label>
                    <button
                      id={`${channel}-enabled`}
                      type="button"
                      role="switch"
                      aria-checked={draft.enabled}
                      aria-label={`${channelLabel} enabled`}
                      onClick={() =>
                        setDrafts((current) => ({
                          ...current,
                          [channel]: {
                            ...current[channel],
                            enabled: !current[channel].enabled
                          }
                        }))
                      }
                      className={[
                        "flex h-[42px] items-center justify-between rounded-[1rem] border px-3 text-sm font-medium transition",
                        draft.enabled
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "border-panel-line bg-white/88 text-muted"
                      ].join(" ")}
                    >
                      <span>{draft.enabled ? "Enabled" : "Disabled"}</span>
                      <span
                        className={[
                          "h-5 w-9 rounded-full border transition",
                          draft.enabled
                            ? "border-emerald-300 bg-emerald-200/90"
                            : "border-slate-200 bg-slate-200/85"
                        ].join(" ")}
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-muted md:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-panel-line/70 bg-panel/55 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Health
                    </p>
                    <p className="mt-2">
                      Last inbound: {formatTimestamp(connection?.lastInboundAt ?? null)}
                    </p>
                    <p className="mt-1">
                      Last outbound: {formatTimestamp(connection?.lastOutboundAt ?? null)}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-panel-line/70 bg-panel/55 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Identity
                    </p>
                    <p className="mt-2">
                      {(connection?.externalWorkspaceLabel ??
                        draft.externalWorkspaceLabel) || "No workspace label"}
                    </p>
                    <p className="mt-1">{draft.externalWorkspaceId || "No workspace id"}</p>
                  </div>
                </div>

                {statusMessages[channel] ? (
                  <p
                    className={[
                      "mt-4 text-sm leading-6",
                      statusMessages[channel]?.tone === "error"
                        ? "text-amber-900"
                        : "text-muted"
                    ].join(" ")}
                  >
                    {statusMessages[channel]?.text}
                  </p>
                ) : null}
              </CardContent>
              <CardFooter>
                <p className="text-xs leading-5 text-muted">
                  Updated {new Date(connection?.updatedAt ?? new Date().toISOString()).toLocaleString()}
                </p>
                <Button
                  variant="outline"
                  disabled={submittingChannel === channel}
                  onClick={() => saveConnection(channel)}
                  aria-label={`Save ${channelLabel} connection`}
                >
                  {submittingChannel === channel
                    ? `Saving ${channelLabel}`
                    : `Save ${channelLabel} connection`}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
