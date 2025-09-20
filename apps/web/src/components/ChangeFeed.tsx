import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useMemo, useState } from "react";
import useEditorStore from "../state/useEditorStore";
import { useTranslation } from "../hooks/useTranslation";
import { applyPatch, rejectPatch, revertPatch } from "../services/api";
import type { PatchEvent } from "../types";

const levelStyles: Record<string, string> = {
  info: "bg-slate-800/70 text-slate-200",
  warning: "bg-amber-500/20 text-amber-200",
  error: "bg-rose-500/20 text-rose-200"
};

const statusStyles: Record<PatchEvent["status"], string> = {
  pending: "bg-blue-500/10 text-blue-200",
  applied: "bg-emerald-500/15 text-emerald-200",
  discarded: "bg-rose-500/15 text-rose-200",
  reverted: "bg-slate-500/20 text-slate-100"
};

function DiffPreview({ diff }: { diff: string }) {
  const content = useMemo(() => diff.trim().split("\n").slice(0, 80).join("\n"), [diff]);
  return (
    <pre className="max-h-48 overflow-auto rounded-lg bg-slate-950/80 p-3 text-[11px] leading-relaxed text-slate-200">
      <code>{content}</code>
    </pre>
  );
}

export function ChangeFeed() {
  const patches = useEditorStore((state) => state.patches);
  const logs = useEditorStore((state) => state.logs);
  const appendLog = useEditorStore((state) => state.appendLog);
  const translation = useTranslation();
  const { changeFeed } = translation;

  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});

  const runPatchAction = useCallback(
    async (patch: PatchEvent, action: () => Promise<void>) => {
      setPendingActions((state) => ({ ...state, [patch.id]: true }));
      try {
        await action();
      } catch (error) {
        appendLog({ level: "error", message: `${changeFeed.actionError}: ${(error as Error).message}` });
      } finally {
        setPendingActions((state) => {
          const next = { ...state };
          delete next[patch.id];
          return next;
        });
      }
    },
    [appendLog, changeFeed.actionError]
  );

  const handleApply = useCallback(
    async (patch: PatchEvent) => {
      await runPatchAction(patch, () => applyPatch(patch.id));
    },
    [runPatchAction]
  );

  const handleReject = useCallback(
    async (patch: PatchEvent) => {
      await runPatchAction(patch, () => rejectPatch(patch.id));
    },
    [runPatchAction]
  );

  const handleRevert = useCallback(
    async (patch: PatchEvent) => {
      await runPatchAction(patch, () => revertPatch(patch.id));
    },
    [runPatchAction]
  );

  return (
    <section
      className="flex h-full flex-col rounded-2xl border border-white/5 bg-slate-900/40 shadow-surface"
      data-tutorial-anchor="change-feed"
    >
      <Tabs.Root defaultValue="patches" className="flex h-full flex-col">
        <Tabs.List className="flex gap-2 border-b border-white/5 px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-400">
          <Tabs.Trigger
            value="patches"
            className="rounded-md px-3 py-2 text-[11px] font-semibold data-[state=active]:bg-slate-800/70 data-[state=active]:text-slate-100"
          >
            {changeFeed.patchesTab(patches.length)}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="events"
            className="rounded-md px-3 py-2 text-[11px] font-semibold data-[state=active]:bg-slate-800/70 data-[state=active]:text-slate-100"
          >
            {changeFeed.eventsTab(logs.length)}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="patches" className="flex-1 overflow-y-auto px-4 py-3">
          {patches.length === 0 ? (
            <p className="text-xs text-slate-500">{changeFeed.emptyPatches}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {patches.map((patch) => {
                const busy = pendingActions[patch.id] ?? false;
                const showApply = patch.status === "pending" || patch.status === "discarded" || patch.status === "reverted";
                return (
                  <article key={patch.id} className="rounded-xl border border-white/5 bg-slate-950/70 p-3 text-sm text-slate-100">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <span>{patch.file}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyles[patch.status]}`}>
                          {changeFeed.statusLabel[patch.status]}
                        </span>
                      </div>
                      <span>{new Date((patch.resolvedAt ?? patch.createdAt)).toLocaleTimeString()}</span>
                    </div>
                    {patch.note && <p className="text-xs text-slate-300">{patch.note}</p>}
                    <DiffPreview diff={patch.diff} />
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {showApply && (
                        <button
                          type="button"
                          onClick={() => void handleApply(patch)}
                          disabled={busy}
                          className="inline-flex items-center justify-center rounded-lg bg-emerald-500/20 px-3 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy ? changeFeed.actions.working : patch.status === "pending" ? changeFeed.actions.apply : changeFeed.actions.reapply}
                        </button>
                      )}
                      {patch.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => void handleReject(patch)}
                          disabled={busy}
                          className="inline-flex items-center justify-center rounded-lg bg-rose-500/20 px-3 py-1 font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy ? changeFeed.actions.working : changeFeed.actions.reject}
                        </button>
                      )}
                      {patch.status === "applied" && (
                        <button
                          type="button"
                          onClick={() => void handleRevert(patch)}
                          disabled={busy}
                          className="inline-flex items-center justify-center rounded-lg bg-amber-500/20 px-3 py-1 font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy ? changeFeed.actions.working : changeFeed.actions.revert}
                        </button>
                      )}
                      {patch.status === "reverted" && (
                        <button
                          type="button"
                          onClick={() => void handleReject(patch)}
                          disabled={busy}
                          className="inline-flex items-center justify-center rounded-lg bg-slate-700/40 px-3 py-1 font-semibold text-slate-200 transition hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy ? changeFeed.actions.working : changeFeed.actions.reject}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="events" className="flex-1 overflow-y-auto px-4 py-3">
          {logs.length === 0 ? (
            <p className="text-xs text-slate-500">{changeFeed.emptyLogs}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm text-slate-100">
              {logs.map((log) => (
                <li key={log.id} className={`rounded-lg border border-white/5 px-3 py-2 text-xs ${levelStyles[log.level]}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium capitalize">{changeFeed.logLevelLabel[log.level]}</span>
                    <span className="text-[10px] uppercase tracking-[0.2em]">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="leading-relaxed text-slate-200">{log.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}
