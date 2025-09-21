import { useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { disconnectOpenAi, loginWithOpenAi, saveOpenAiApiKey } from "../services/api";
import useEditorStore from "../state/useEditorStore";

export function OpenAIConnectCard() {
  const { openAi } = useTranslation();
  const openAiStatus = useEditorStore((state) => state.openAiStatus);
  const setOpenAiStatus = useEditorStore((state) => state.setOpenAiStatus);
  const appendLog = useEditorStore((state) => state.appendLog);

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const docsUrl = "https://github.com/openai/codex#readme";
  const hasConnection = openAiStatus.connected;

  const formatStatusMessage = (status = openAiStatus) => {
    if (!status.connected) {
      return openAi.statusMissing;
    }
    const masked = status.maskedKey ?? "••••";
    const label =
      status.method === "apiKey"
        ? openAi.statusManual(masked)
        : status.label ?? openAi.statusMasked(masked);
    return openAi.statusConnected(label);
  };

  const connectionLabel = formatStatusMessage();

  const handleLogin = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const status = await loginWithOpenAi();
      setOpenAiStatus(status);
      appendLog({
        level: "info",
        message: formatStatusMessage(status)
      });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      appendLog({ level: "error", message });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setError(null);
    try {
      const status = await disconnectOpenAi();
      setOpenAiStatus(status);
      appendLog({ level: "info", message: openAi.statusMissing });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      appendLog({ level: "error", message });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSaveKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setError(openAi.manualError);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const status = await saveOpenAiApiKey(trimmed);
      setOpenAiStatus(status);
      setApiKeyInput("");
      appendLog({ level: "info", message: formatStatusMessage(status) });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      appendLog({ level: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

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

      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {connectionLabel}
        </div>
        {hasConnection && openAiStatus.method === "cli" && (
          <p className="text-xs text-slate-400">
            {openAi.cliProfile(openAiStatus.cliVariant ?? "openai", openAiStatus.profile ?? "default")}
          </p>
        )}
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <div className="flex flex-col gap-3">
          {!hasConnection && <p className="text-xs text-slate-400">{openAi.loginHint}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLogin}
              disabled={isConnecting || isDisconnecting || isSaving}
              className="rounded-lg bg-codex-primary px-3 py-2 text-xs font-semibold text-white shadow-surface transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting ? openAi.loggingIn : hasConnection ? openAi.reconnect : openAi.login}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={!hasConnection || isDisconnecting || isConnecting || isSaving}
              className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDisconnecting ? openAi.disconnecting : openAi.disconnect}
            </button>
          </div>
          <p className="text-xs text-slate-500">{openAi.loginDetails}</p>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-white/5 bg-slate-900/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">{openAi.manualLabel}</p>
          <p className="text-xs text-slate-400">{openAi.manualHint}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(event) => {
                setApiKeyInput(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              placeholder={openAi.manualPlaceholder}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-codex-primary focus:outline-none focus:ring-1 focus:ring-codex-primary"
            />
            <button
              type="button"
              onClick={handleSaveKey}
              disabled={isConnecting || isDisconnecting || isSaving}
              className="rounded-lg bg-emerald-500/80 px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? openAi.manualSaving : openAi.manualSave}
            </button>
          </div>
          <p className="text-xs text-slate-500">{openAi.manualDetails}</p>
        </div>
      </div>
    </section>
  );
}
