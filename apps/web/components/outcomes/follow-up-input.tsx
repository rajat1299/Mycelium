"use client";

import { useFormStatus } from "react-dom";
import { BarsSpinner } from "../ui/bars-spinner";

type FollowUpInputProps = {
  action: (formData: FormData) => Promise<void>;
  hasConversation?: boolean;
  disabled?: boolean;
};

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-label="Send"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-all duration-150 hover:bg-accent-hover active:scale-95 disabled:opacity-40"
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
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19V5m-7 7 7-7 7 7" />
        </svg>
      )}
    </button>
  );
}

function FeedbackActions({ disabled }: { disabled?: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        disabled={disabled}
        className="rounded-lg p-1.5 text-muted/50 transition-colors hover:bg-surface-elevated hover:text-muted"
        aria-label="Helpful"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 10v12m8-16.12L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
      </button>
      <button
        type="button"
        disabled={disabled}
        className="rounded-lg p-1.5 text-muted/50 transition-colors hover:bg-surface-elevated hover:text-muted"
        aria-label="Not helpful"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
        </svg>
      </button>
      <button
        type="button"
        disabled={disabled}
        className="rounded-lg p-1.5 text-muted/50 transition-colors hover:bg-surface-elevated hover:text-muted"
        aria-label="Copy"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      </button>
      <button
        type="button"
        disabled={disabled}
        className="rounded-lg p-1.5 text-muted/50 transition-colors hover:bg-surface-elevated hover:text-muted"
        aria-label="Share"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
        </svg>
      </button>
    </div>
  );
}

export function FollowUpInput({
  action,
  hasConversation = false,
  disabled = false
}: FollowUpInputProps) {
  return (
    <div className="space-y-2">
      {/* Feedback icons row — visible when conversation has content */}
      {hasConversation && (
        <div className="flex justify-end px-1">
          <FeedbackActions disabled={disabled} />
        </div>
      )}

      {/* Input container */}
      <form action={action}>
        <div
          className={[
            "rounded-2xl bg-panel shadow-card transition-shadow duration-200 focus-within:shadow-card-hover",
            disabled ? "opacity-60" : ""
          ].join(" ")}
        >
          {/* Textarea */}
          <fieldset disabled={disabled}>
            <textarea
              name="content"
              rows={1}
              placeholder="Type a command..."
              className="block w-full resize-none rounded-t-2xl bg-transparent px-5 pb-2 pt-3.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted/50"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              onInput={(event) => {
                const target = event.currentTarget;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between px-3.5 pb-3">
              {/* Left: attachment */}
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted/50 transition-colors hover:bg-surface-elevated hover:text-muted"
                aria-label="Attach file"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>

              {/* Right: mic + submit */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted/50 transition-colors hover:bg-surface-elevated hover:text-muted"
                  aria-label="Voice input"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                </button>
                <SubmitButton disabled={disabled} />
              </div>
            </div>
          </fieldset>
        </div>
      </form>
    </div>
  );
}
