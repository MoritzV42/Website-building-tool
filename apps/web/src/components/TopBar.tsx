import { useMemo, useState } from "react";
import type { Language } from "../data/translations";
import { connectRepository, fetchGitStatus } from "../services/api";
import useEditorStore from "../state/useEditorStore";
import { useTranslation } from "../hooks/useTranslation";

function BranchBadge({ branch }: { branch?: string }) {
  if (!branch) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-200 shadow-inset">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      {branch}
    </span>
  );
}

export function TopBar() {
  const translation = useTranslation();
  const { topBar, languageToggle } = translation;
  const repositoryPath = useEditorStore((state) => state.repositoryPath);
  const setRepositoryPath = useEditorStore((state) => state.setRepositoryPath);
  const setGitStatus = useEditorStore((state) => state.setGitStatus);
  const gitStatus = useEditorStore((state) => state.gitStatus);
  const websocketReady = useEditorStore((state) => state.websocketReady);
  const appendLog = useEditorStore((state) => state.appendLog);
  const serverUrl = useEditorStore((state) => state.serverUrl);
  const language = useEditorStore((state) => state.language);
  const setLanguage = useEditorStore((state) => state.setLanguage);

  const [pathInput, setPathInput] = useState(repositoryPath ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branchLabel = useMemo(() => {
    if (!gitStatus) return "";
    if (gitStatus.current && gitStatus.tracking) {
      return `${gitStatus.current} ↔ ${gitStatus.tracking}`;
    }
    return gitStatus.current ?? "";
  }, [gitStatus]);

  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pathInput) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { repository } = await connectRepository(pathInput);
      setRepositoryPath(repository);
      appendLog({ level: "info", message: topBar.connectLog(repository) });
      const status = await fetchGitStatus();
      setGitStatus(status);
    } catch (err) {
      const message = (err as Error).message || topBar.connectErrorFallback;
      setError(message);
      appendLog({ level: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-100">{topBar.title}</h1>
            <p className="text-sm text-slate-400">{topBar.subtitle(serverUrl)}</p>
          </div>
          <span
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium shadow-inset ${
              websocketReady ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-rose-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${websocketReady ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`}
            />
            {websocketReady ? topBar.statusConnected : topBar.statusOffline}
          </span>
        </div>

        <form
          onSubmit={handleConnect}
          className="flex w-full flex-col gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-4 shadow-surface sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">{topBar.repositoryLabel}</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-inner outline-none focus:border-codex-primary focus:ring-2 focus:ring-codex-primary/40"
              placeholder={topBar.repositoryPlaceholder}
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-lg bg-codex-primary px-4 py-2 text-sm font-semibold text-white shadow-surface transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? topBar.connecting : repositoryPath ? topBar.reconnect : topBar.connect}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <BranchBadge branch={branchLabel} />
          {gitStatus && !gitStatus.isClean && (
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-200">
              {topBar.branchChanges(gitStatus.files.length)}
            </span>
          )}
          <div
            role="group"
            aria-label={languageToggle.label}
            className="flex overflow-hidden rounded-full border border-white/10 bg-slate-900/60 text-xs"
          >
            {(["de", "en"] as Language[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                className={`px-3 py-1 font-semibold transition ${
                  language === code
                    ? "bg-codex-primary text-white"
                    : "text-slate-300 hover:bg-slate-800/80"
                }`}
              >
                {languageToggle.options[code]}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && (
        <div className="border-t border-rose-500/30 bg-rose-950/50 px-6 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}
    </header>
  );
}
