import { useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { updateOpenAiKey } from "../services/api";
import useEditorStore from "../state/useEditorStore";

export function OpenAIConnectCard() {
  const { openAi } = useTranslation();
  const openAiStatus = useEditorStore((state) => state.openAiStatus);
  const setOpenAiStatus = useEditorStore((state) => state.setOpenAiStatus);
  const appendLog = useEditorStore((state) => state.appendLog);

  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasKey = openAiStatus.configured;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!apiKey.trim()) {
      setError(openAi.errorEmpty);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const status = await updateOpenAiKey(apiKey.trim());
      setOpenAiStatus(status);
      setApiKey("");
      setIsEditing(false);
      appendLog({
        level: "info",
        message: status.configured && status.maskedKey ? openAi.statusConnected(status.maskedKey) : openAi.statusMissing
      });
    } catch (err) {
      setError((err as Error).message);
      appendLog({ level: "error", message: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const status = await updateOpenAiKey("");
      setOpenAiStatus(status);
      appendLog({ level: "info", message: openAi.statusMissing });
    } catch (err) {
      setError((err as Error).message);
      appendLog({ level: "error", message: (err as Error).message });
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const docsUrl = "https://platform.openai.com/account/api-keys";

  return (
    <section
      data-tutorial-anchor="gpt-connect"
      className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 shadow-surface"
    >
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">{openAi.title}</h2>
            <p className="text-xs text-slate-400">{openAi.description}</p>
          </div>
          <a
            className="text-xs font-semibold text-codex-primary hover:underline"
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
          >
            {openAi.docsLabel}
          </a>
        </div>
        <p className="text-xs text-slate-500">{openAi.helper}</p>
      </div>

      {hasKey && !isEditing ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {openAi.statusConnected(openAiStatus.maskedKey ?? "••••")}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setError(null);
              }}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-codex-primary/60 hover:text-codex-primary"
            >
              {openAi.replace}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={isSaving}
              className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-60"
            >
              {openAi.clear}
            </button>
          </div>
        </div>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="text-[11px] uppercase tracking-[0.35em] text-slate-400">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={openAi.placeholder}
            className="rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 shadow-inner outline-none focus:border-codex-primary focus:ring-2 focus:ring-codex-primary/40"
          />
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-codex-primary px-3 py-2 text-xs font-semibold text-white shadow-surface transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? openAi.connecting : openAi.connect}
            </button>
            {hasKey && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setApiKey("");
                  setError(null);
                }}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-400 hover:text-slate-100"
              >
                {openAi.cancel}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
