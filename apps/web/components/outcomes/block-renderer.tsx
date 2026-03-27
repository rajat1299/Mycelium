"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { OutcomeFeedItem } from "./outcome-feed";
import { motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../ui/cn";
import { AssistantNarrativeBlock } from "./assistant-narrative-block";
import { PhaseGroup } from "./phase-group";

type BlockRendererProps = {
  item: OutcomeFeedItem;
  delay: number;
  ease: readonly [number, number, number, number];
  isFromSSE: boolean;
  isTurnLive: boolean;
  outcomePrompt: string;
  promptPreview: string;
  showFullPrompt: boolean;
  setShowFullPrompt: Dispatch<SetStateAction<boolean>>;
  renderIntentText: (message: string) => ReactNode;
  renderPlan: (
    item: Extract<OutcomeFeedItem, { type: "plan" }>
  ) => ReactNode;
  renderTask: (
    item: Extract<OutcomeFeedItem, { type: "task" }>
  ) => ReactNode;
  renderArtifactDelivery: (
    item: Extract<OutcomeFeedItem, { type: "artifact-delivery" }>
  ) => ReactNode;
  renderApproval: (
    item: Extract<OutcomeFeedItem, { type: "approval" }>
  ) => ReactNode;
};

export function BlockRenderer({
  item,
  delay,
  ease,
  isFromSSE,
  isTurnLive,
  outcomePrompt,
  promptPreview,
  showFullPrompt,
  setShowFullPrompt,
  renderIntentText,
  renderPlan,
  renderTask,
  renderArtifactDelivery,
  renderApproval
}: BlockRendererProps) {
  switch (item.type) {
    case "prompt":
      return (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, x: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.4, ease }}
          className="flex justify-end"
        >
          <div className="max-w-[85%] rounded-2xl rounded-br-lg bg-accent-soft px-5 py-3.5">
            <p className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap [text-wrap:pretty]">
              {promptPreview}
            </p>
            {outcomePrompt.length > 280 && (
              <button
                type="button"
                onClick={() => setShowFullPrompt((current) => !current)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink"
              >
                {showFullPrompt ? "Show less" : "Show more"}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    showFullPrompt && "rotate-180"
                  )}
                />
              </button>
            )}
          </div>
        </motion.div>
      );

    case "intent":
      return (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease, delay }}
        >
          <p className="font-serif text-lg leading-[1.65] text-ink sm:text-xl [text-wrap:pretty]">
            {isTurnLive && isFromSSE ? renderIntentText(item.message) : item.message}
          </p>
        </motion.div>
      );

    case "assistant-message": {
      const content = <AssistantNarrativeBlock message={item.message} />;

      return (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease, delay }}
        >
          {item.message.kind === "transition" ? (
            <PhaseGroup kind="transition">{content}</PhaseGroup>
          ) : (
            content
          )}
        </motion.div>
      );
    }

    case "plan":
      return renderPlan(item);

    case "task":
      return renderTask(item);

    case "artifact-delivery":
      return renderArtifactDelivery(item);

    case "delivery-note":
      return (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease, delay }}
        >
          <div className="prose-feed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {item.message}
            </ReactMarkdown>
          </div>
        </motion.div>
      );

    case "approval":
      return renderApproval(item);

    case "message":
      return (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease }}
        >
          {item.message.role === "user" ? (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-lg bg-accent-soft px-5 py-3.5">
                <p className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap [text-wrap:pretty]">
                  {item.message.content}
                </p>
              </div>
            </div>
          ) : (
            <div className="prose-feed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {item.message.content}
              </ReactMarkdown>
            </div>
          )}
        </motion.div>
      );

    case "loading":
      return (
        <motion.div
          key={item.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease }}
          className="flex items-center gap-2 py-6 text-sm text-muted"
        >
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span>Preparing steps&hellip;</span>
        </motion.div>
      );
  }
}
