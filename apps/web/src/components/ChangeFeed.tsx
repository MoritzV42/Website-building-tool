import * as Tabs from "@radix-ui/react-tabs";
import { useMemo } from "react";
import useEditorStore from "../state/useEditorStore";
import { useTranslation } from "../hooks/useTranslation";

const levelStyles: Record<string, string> = {
  info: "bg-slate-800/70 text-slate-200",
  warning: "bg-amber-500/20 text-amber-200",
  error: "bg-rose-500/20 text-rose-200"
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
  const translation = useTranslation();
  const { changeFeed } = translation;

  return (
    <section className="flex h-full flex-col rounded-2xl border border-white/5 bg-slate-900/40 shadow-surface">
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
              {patches.map((patch) => (
                <article key={patch.id} className="rounded-xl border border-white/5 bg-slate-950/70 p-3 text-sm text-slate-100">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                    <span>{patch.file}</span>
                    <span>{new Date(patch.createdAt).toLocaleTimeString()}</span>
                  </div>
                  {patch.note && <p className="text-xs text-slate-300">{patch.note}</p>}
                  <DiffPreview diff={patch.diff} />
                </article>
              ))}
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
