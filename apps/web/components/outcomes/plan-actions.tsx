"use client";

import { useFormStatus } from "react-dom";
import { Badge } from "../ui/badge";
import { BarsSpinner } from "../ui/bars-spinner";
import { RichButton } from "../ui/rich-button";

type PlanActionsProps = {
  planId: string | null;
  hasRun: boolean;
  createPlanAction: () => Promise<void>;
  startRunAction: (formData: FormData) => Promise<void>;
};

type SubmitButtonProps = {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  color?: "accent" | "sand" | "slate";
};

function SubmitButton({
  label,
  pendingLabel,
  disabled,
  color = "accent"
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <RichButton type="submit" disabled={disabled || pending} color={color}>
      {pending ? <BarsSpinner size={14} color="currentColor" /> : null}
      {pending ? pendingLabel : label}
    </RichButton>
  );
}

export function PlanActions({
  planId,
  hasRun,
  createPlanAction,
  startRunAction
}: PlanActionsProps) {
  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Orchestration controls
          </p>
          <h2 className="font-serif text-xl tracking-tight text-ink">
            Generate the plan, then start the run.
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            Milestone 2 keeps execution deterministic: one draft plan per outcome,
            one selected run at a time, and live state over the outcome stream.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={planId ? "emerald" : "amber"}>
            {planId ? "Draft plan ready" : "No plan yet"}
          </Badge>
          <Badge variant={hasRun ? "sky" : "slate"}>
            {hasRun ? "Run selected" : "Run idle"}
          </Badge>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <form action={createPlanAction} className="space-y-3">
          <div className="rounded-[1.5rem] border border-panel-line bg-surface-elevated p-4">
            <p className="text-sm font-semibold text-ink">Draft plan</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Create the persisted three-step orchestration graph for this outcome.
            </p>
          </div>
          <SubmitButton
            label="Generate draft plan"
            pendingLabel="Generating draft plan"
            disabled={Boolean(planId)}
            color="accent"
          />
        </form>

        <form action={startRunAction} className="space-y-3">
          <input type="hidden" name="planId" value={planId ?? ""} />
          <div className="rounded-[1.5rem] border border-panel-line bg-surface-elevated p-4">
            <p className="text-sm font-semibold text-ink">Run timeline</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Materialize the plan into durable steps and stream their initial state.
            </p>
          </div>
          <SubmitButton
            label="Start run"
            pendingLabel="Starting run"
            disabled={!planId}
            color="sand"
          />
        </form>
      </div>
    </section>
  );
}
