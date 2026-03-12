import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NewOutcomeForm } from "../components/outcomes/new-outcome-form";
import { OutcomeList } from "../components/outcomes/outcome-list";
import {
  createOutcome,
  getDefaultUserId,
  getDefaultWorkspaceId,
  listOutcomes
} from "../lib/api";

export const dynamic = "force-dynamic";

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
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-10">
      <header className="grid gap-4 border-b border-panel-line pb-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-end">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent">
            Mycelium
          </p>
          <h1 className="max-w-3xl font-serif text-4xl tracking-tight text-ink sm:text-5xl">
            Command center for long-running AI work.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            Start an outcome, inspect progress, and keep the operator view centered
            on active work instead of chat history.
          </p>
        </div>
        <div className="rounded-3xl border border-panel-line bg-panel p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Default scope
          </p>
          <dl className="mt-4 grid gap-3 text-sm text-ink">
            <div>
              <dt className="text-muted">Workspace</dt>
              <dd className="font-medium">{workspaceId}</dd>
            </div>
            <div>
              <dt className="text-muted">User</dt>
              <dd className="font-medium">{userId}</dd>
            </div>
            <div>
              <dt className="text-muted">Active outcomes</dt>
              <dd className="font-medium">{outcomes.length}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <NewOutcomeForm action={createOutcomeAction} />
        <OutcomeList outcomes={outcomes} />
      </section>
    </main>
  );
}
