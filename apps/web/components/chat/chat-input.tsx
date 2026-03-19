"use client";

import { useFormStatus } from "react-dom";
import { BarsSpinner } from "../ui/bars-spinner";

type ChatInputProps = {
  action: (formData: FormData) => Promise<void>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Create outcome"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white transition-all duration-150 hover:bg-accent-hover hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
    >
      {pending ? (
        <BarsSpinner size={14} color="currentColor" />
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14m-7-7 7 7-7 7" />
        </svg>
      )}
    </button>
  );
}

export function ChatInput({ action }: ChatInputProps) {
  return (
    <form action={action}>
      <div className="relative rounded-2xl border border-panel-line bg-panel shadow-sm transition-all duration-200 focus-within:border-accent/30 focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
        <textarea
          name="prompt"
          required
          rows={3}
          placeholder="What should we work on next?"
          className="block w-full resize-none rounded-2xl bg-transparent px-5 pb-14 pt-4 text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted/50"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted/60 transition-colors duration-150 hover:bg-panel-line/30 hover:text-muted"
            aria-label="Attach file"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <SubmitButton />
        </div>
      </div>
      <p className="mt-2.5 text-center text-[11px] text-muted/50">
        Press <kbd className="rounded border border-panel-line bg-panel px-1 py-0.5 font-mono text-[10px]">⌘</kbd> + <kbd className="rounded border border-panel-line bg-panel px-1 py-0.5 font-mono text-[10px]">↵</kbd> to submit
      </p>
    </form>
  );
}
