"use client";

import { startTransition, useEffect, useState } from "react";
import type { Plan } from "@computer-oss/protocol";
import { subscribeToOutcomeEvents } from "../../lib/events";
import { Badge } from "../ui/badge";

type PlanGraphProps = {
  outcomeId: string;
  initialPlan: Plan | null;
};

const capabilityVariant = {
  reasoning: "sky",
  coding: "emerald",
  document: "amber",
  research: "sky",
  browser: "slate",
  terminal: "slate",
  api: "slate",
  fast_tasks: "amber",
  fallback: "slate"
} as const;

export function PlanGraph({ outcomeId, initialPlan }: PlanGraphProps) {
  const [plan, setPlan] = useState<Plan | null>(initialPlan);

  useEffect(() => {
    setPlan(initialPlan);
  }, [initialPlan]);

  useEffect(() => {
    return subscribeToOutcomeEvents(outcomeId, (event) => {
      if (event.type !== "plan.created") {
        return;
      }

      startTransition(() => {
        setPlan(event.data);
      });
    });
  }, [outcomeId]);

  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Draft plan
          </p>
          <h2 className="font-serif text-xl tracking-tight text-ink">
            Orchestration graph
          </h2>
          <p className="text-sm leading-6 text-muted">
            A durable dependency map for the first execution attempt.
          </p>
        </div>
        {plan ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="emerald">{plan.status}</Badge>
            <Badge variant="slate">{plan.nodes.length} nodes</Badge>
            <Badge variant="slate">{plan.edges.length} edges</Badge>
          </div>
        ) : null}
      </div>

      {!plan ? (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-panel-line bg-shell px-5 py-8 text-sm leading-6 text-muted">
          Generate a draft plan to see the orchestration graph.
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-stretch">
          {plan.nodes
            .slice()
            .sort((left, right) => left.position - right.position)
            .map((node, index, nodes) => (
              <div
                key={node.id}
                className="flex flex-1 flex-col items-stretch gap-3 lg:flex-row lg:items-center"
              >
                <article className="relative min-h-[12rem] flex-1 overflow-hidden rounded-[1.7rem] border border-panel-line bg-surface-elevated p-5">
                  <div className="absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]" />
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="slate" size="sm">
                      {node.kind}
                    </Badge>
                    <span className="text-xs font-semibold tracking-[0.22em] text-muted">
                      {String(node.position + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-4 text-2xl leading-tight text-ink">{node.title}</h3>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-muted">
                    Capability routing remains deterministic in M2. This node is
                    pinned to the {node.capability.replace("_", " ")} family.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Badge
                      variant={
                        capabilityVariant[
                          node.capability as keyof typeof capabilityVariant
                        ] ?? "slate"
                      }
                    >
                      {node.capability}
                    </Badge>
                  </div>
                </article>

                {index < nodes.length - 1 ? (
                  <div className="flex items-center justify-center px-2 py-1 lg:w-16 lg:px-0">
                    <div className="h-8 w-px bg-[linear-gradient(180deg,transparent,var(--accent),transparent)] lg:h-px lg:w-full" />
                  </div>
                ) : null}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
