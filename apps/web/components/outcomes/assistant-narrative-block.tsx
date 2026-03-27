"use client";

import type { AssistantMessageSnapshot } from "@computer-oss/protocol";
import { FileCode2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../ui/cn";

type AssistantNarrativeBlockProps = {
  message: AssistantMessageSnapshot;
};

const KIND_CHROME = {
  acknowledgment: {
    label: null,
    icon: null,
    containerClassName: "text-muted",
    bodyClassName: "prose-feed text-muted"
  },
  transition: {
    label: "Phase",
    icon: Sparkles,
    containerClassName:
      "rounded-2xl border border-panel-line/60 bg-panel/70 px-4 py-3.5",
    bodyClassName: "prose-feed text-ink"
  },
  delivery: {
    label: "Delivery",
    icon: FileCode2,
    containerClassName:
      "rounded-2xl border border-accent/20 bg-accent-soft/70 px-4 py-4 shadow-sm",
    bodyClassName: "prose-feed text-ink"
  }
} as const;

function NarrativeBody({
  message,
  className
}: {
  message: AssistantMessageSnapshot;
  className: string;
}) {
  if (message.status === "streaming") {
    return (
      <div className={className}>
        <p className="whitespace-pre-wrap [text-wrap:pretty]">
          {message.content}
          <span
            className="ml-0.5 inline-block h-[1.1em] w-[2px] bg-accent align-text-bottom"
            style={{ animation: "blink-cursor 1s step-end infinite" }}
          />
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
    </div>
  );
}

export function AssistantNarrativeBlock({
  message
}: AssistantNarrativeBlockProps) {
  const chrome = KIND_CHROME[message.kind];
  const Icon = chrome.icon;

  return (
    <div
      data-kind={message.kind}
      data-testid="assistant-narrative-block"
      className={cn(chrome.containerClassName)}
    >
      {chrome.label ? (
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
          <span>{chrome.label}</span>
        </div>
      ) : null}
      <NarrativeBody message={message} className={chrome.bodyClassName} />
    </div>
  );
}
