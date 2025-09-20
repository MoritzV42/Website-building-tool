import { useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { disconnectOpenAi, loginWithOpenAi } from "../services/api";
import useEditorStore from "../state/useEditorStore";

export function OpenAIConnectCard() {
  const { openAi } = useTranslation();
  const openAiStatus = useEditorStore((state) => state.openAiStatus);
  const setOpenAiStatus = useEditorStore((state) => state.setOpenAiStatus);
  const appendLog = useEditorStore((state) => state.appendLog);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const docsUrl = "https://platform.openai.com/docs/guides/openai-cli";
  const hasConnection = openAiStatus.connected;
  const connectionLabel = hasConnection
    ? openAi.statusConnected(openAiStatus.label ?? openAi.statusMasked(openAiStatus.maskedKey ?? "••••"))
    : openAi.statusMissing;

  const handleLogin = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const status = await loginWithOpenAi();
      setOpenAiStatus(status);
      appendLog({
        level: "info",
        message: status.connected
          ? openAi.statusConnected(status.label ?? openAi.statusMasked(status.maskedKey ?? "••••"))
          : openAi.statusMissing
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
          <p className="text-xs text-slate-400">{openAi.cliProfile(openAiStatus.profile ?? "default")}</p>
        )}
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <div className="flex flex-col gap-3">
          {!hasConnection && <p className="text-xs text-slate-400">{openAi.loginHint}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLogin}
              disabled={isConnecting || isDisconnecting}
              className="rounded-lg bg-codex-primary px-3 py-2 text-xs font-semibold text-white shadow-surface transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting ? openAi.loggingIn : hasConnection ? openAi.reconnect : openAi.login}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={!hasConnection || isDisconnecting || isConnecting}
              className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDisconnecting ? openAi.disconnecting : openAi.disconnect}
            </button>
          </div>
          <p className="text-xs text-slate-500">{openAi.loginDetails}</p>
        </div>
      </div>
    </section>
  );
}
