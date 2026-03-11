"use client";

import { useFormStatus } from "react-dom";

type NewOutcomeFormProps = {
  action: (formData: FormData) => Promise<void>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-shell transition hover:bg-accent disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Launching..." : "Create outcome"}
    </button>
  );
}

export function NewOutcomeForm({ action }: NewOutcomeFormProps) {
  return (
    <section className="rounded-[2rem] border border-panel-line bg-panel p-6 shadow-panel">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
          New outcome
        </p>
        <h2 className="font-serif text-3xl tracking-tight text-ink">
          Start from the result you want.
        </h2>
        <p className="text-sm leading-6 text-muted">
          Keep it outcome-focused. The control plane will translate it into runs,
          approvals, and artifacts.
        </p>
      </div>

      <form action={action} className="mt-6 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Outcome prompt</span>
          <textarea
            name="prompt"
            required
            rows={7}
            placeholder="Ship the release notes and draft a launch-ready customer summary."
            className="w-full rounded-[1.5rem] border border-panel-line bg-white/80 px-4 py-4 text-sm leading-6 text-ink outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </label>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs leading-5 text-muted">
            Side-effecting work will pause for approval later in the flow.
          </p>
          <SubmitButton />
        </div>
      </form>
    </section>
  );
}
