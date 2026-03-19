import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ChatInput } from "../components/chat/chat-input";
import {
  createOutcome,
  getDefaultUserId,
  getDefaultWorkspaceId,
  listOutcomes
} from "../lib/api";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function statusDot(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-400";
    case "running":
      return "bg-sky-400";
    case "failed":
      return "bg-amber-400";
    default:
      return "bg-accent/50";
  }
}

export default async function HomePage() {
  const workspaceId = getDefaultWorkspaceId();
  const userId = getDefaultUserId();
  const outcomes = await listOutcomes(workspaceId);

  async function createOutcomeAction(formData: FormData) {
    "use server";

    const prompt = String(formData.get("prompt") ?? "").trim();

    if (!prompt) {
      return;
    }

    const created = await createOutcome({
      workspaceId,
      userId,
      prompt,
      source: "web"
    });

    revalidatePath("/");
    redirect(`/outcomes/${created.id}`);
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Center: chat interface */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 sm:px-10">
        <div className="w-full max-w-[640px]">
          <h1 className="text-center font-serif text-[2.5rem] leading-[1.12] tracking-tight text-ink sm:text-[2.85rem]">
            Mycelium works for you.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-center text-sm leading-relaxed text-muted">
            Start from the result you want. Mycelium handles plans, runs, and
            artifacts.
          </p>

          <div className="mt-10">
            <ChatInput action={createOutcomeAction} />
          </div>

          {/* Quick action suggestions */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              "Research & report",
              "Draft release notes",
              "Run code review",
              "Automate a workflow"
            ].map((label) => (
              <span
                key={label}
                className="cursor-default rounded-full border border-panel-line px-3.5 py-1.5 text-[12px] font-medium text-muted/70 transition-colors duration-150 hover:border-accent/25 hover:text-muted"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right rail: active outcomes */}
      {outcomes.length > 0 ? (
        <aside className="w-full shrink-0 border-t border-panel-line bg-sidebar-bg/50 p-5 lg:w-[280px] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Active outcomes
            </p>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold tabular-nums text-accent">
              {outcomes.length}
            </span>
          </div>

          <ul className="mt-4 space-y-1">
            {outcomes.map((outcome) => (
              <li key={outcome.id}>
                <Link
                  href={`/outcomes/${outcome.id}`}
                  className="group block rounded-xl px-3 py-2.5 transition-all duration-150 hover:bg-sidebar-hover"
                >
                  <p className="line-clamp-2 text-[13px] font-medium leading-5 text-ink transition-colors duration-150 group-hover:text-accent">
                    {outcome.prompt}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className={[
                        "inline-block h-1.5 w-1.5 rounded-full",
                        statusDot(outcome.status)
                      ].join(" ")}
                    />
                    <span className="text-[11px] text-muted">
                      {outcome.status}
                    </span>
                    <span className="text-[11px] text-muted/50">
                      {formatTimestamp(outcome.updatedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
