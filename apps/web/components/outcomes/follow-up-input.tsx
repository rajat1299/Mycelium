"use client";

import { useFormStatus } from "react-dom";
import { BarsSpinner } from "../ui/bars-spinner";

type FollowUpInputProps = {
  action: (formData: FormData) => Promise<void>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Send follow-up"
      className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white transition-all duration-150 hover:bg-accent-hover disabled:opacity-50"
    >
      {pending ? (
        <BarsSpinner size={16} color="currentColor" />
      ) : (
        <svg
          width="18"
          height="18"
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

export function FollowUpInput({ action }: FollowUpInputProps) {
  return (
    <div className="border-t border-panel-line bg-shell/90 px-8 py-5 backdrop-blur">
      <form action={action}>
        <div className="rounded-[1.8rem] border border-panel-line bg-panel shadow-panel">
          <textarea
            name="content"
            rows={2}
            placeholder="Type a command..."
            className="block w-full resize-none rounded-[1.8rem] bg-transparent px-5 pb-14 pt-4 text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted/55"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between px-4 pb-4">
            <button
              type="button"
              aria-label="Attach follow-up"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-sidebar-hover hover:text-ink"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Voice command"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-sidebar-hover hover:text-ink"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
                  <path d="M19 10a7 7 0 0 1-14 0M12 19v2M8 21h8" />
                </svg>
              </button>
              <SubmitButton />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
