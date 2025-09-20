import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createTask } from "../services/api";
import useEditorStore from "../state/useEditorStore";
import type { Task } from "../types";

const STATUS_COLORS: Record<Task["status"], string> = {
  pending: "bg-slate-500/20 text-slate-300",
  processing: "bg-amber-500/20 text-amber-200",
  completed: "bg-emerald-500/20 text-emerald-200",
  failed: "bg-rose-500/20 text-rose-200"
};

function TaskBadge({ status }: { status: Task["status"] }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[status]}`}>{status}</span>;
}

export function TaskComposer() {
  const selectedSelector = useEditorStore((state) => state.selectedSelector);
  const setSelectedSelector = useEditorStore((state) => state.setSelectedSelector);
  const upsertTask = useEditorStore((state) => state.upsertTask);
  const tasks = useEditorStore((state) => state.tasks);
  const appendLog = useEditorStore((state) => state.appendLog);
  const [selector, setSelector] = useState(selectedSelector ?? "");
  const [goal, setGoal] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedSelector) {
      setSelector(selectedSelector);
    }
  }, [selectedSelector]);

  const orderedTasks = useMemo(
    () => [...tasks].sort((a, b) => b.createdAt - a.createdAt),
    [tasks]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selector.trim() || !goal.trim()) return;
    setIsSubmitting(true);
    try {
      const task = await createTask({ selector: selector.trim(), goal: goal.trim() });
      upsertTask(task);
      appendLog({ level: "info", message: `Task queued for ${task.selector}` });
      setGoal("");
    } catch (error) {
      appendLog({ level: "error", message: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearSelector = () => {
    setSelector("");
    setSelectedSelector(null);
  };

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 shadow-surface">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">Task Composer</h2>
            <p className="text-xs text-slate-400">Describe the atomic change you want Codex to perform.</p>
          </div>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Selector</label>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 shadow-inner outline-none focus:border-codex-primary focus:ring-2 focus:ring-codex-primary/40"
                placeholder="e.g. header > h1"
                value={selector}
                onChange={(event) => setSelector(event.target.value)}
              />
              {selector && (
                <button
                  type="button"
                  onClick={handleClearSelector}
                  className="rounded-md border border-white/10 px-2 py-2 text-xs text-slate-300 hover:border-rose-500/50 hover:text-rose-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Goal</label>
            <textarea
              rows={5}
              className="resize-none rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 shadow-inner outline-none focus:border-codex-primary focus:ring-2 focus:ring-codex-primary/40"
              placeholder="Increase CTA size, set background to #6C5CE7, add hover shadow"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !selector || !goal}
            className="inline-flex items-center justify-center rounded-lg bg-codex-primary px-4 py-2 text-sm font-semibold text-white shadow-surface transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Dispatching…" : "Send to Codex"}
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl border border-white/5 bg-slate-900/40 shadow-surface">
        <div className="border-b border-white/5 px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Task Queue</h3>
        </div>
        <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto px-4 py-3">
          {orderedTasks.length === 0 && (
            <p className="text-xs text-slate-500">No tasks yet — use the composer above to get started.</p>
          )}
          {orderedTasks.map((task) => (
            <article
              key={task.id}
              className="rounded-lg border border-white/5 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 shadow-inner"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-slate-200">{task.selector}</span>
                <TaskBadge status={task.status} />
              </div>
              <p className="text-xs text-slate-400">{task.goal}</p>
              {task.error && <p className="mt-1 text-xs text-rose-300">{task.error}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
