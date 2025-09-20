import { useMemo, useState } from "react";
import { connectRepository, fetchGitStatus } from "../services/api";
import useEditorStore from "../state/useEditorStore";

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
  const repositoryPath = useEditorStore((state) => state.repositoryPath);
  const setRepositoryPath = useEditorStore((state) => state.setRepositoryPath);
  const setGitStatus = useEditorStore((state) => state.setGitStatus);
  const gitStatus = useEditorStore((state) => state.gitStatus);
  const websocketReady = useEditorStore((state) => state.websocketReady);
  const appendLog = useEditorStore((state) => state.appendLog);
  const serverUrl = useEditorStore((state) => state.serverUrl);

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
      appendLog({ level: "info", message: `Repository connected: ${repository}` });
      const status = await fetchGitStatus();
      setGitStatus(status);
    } catch (err) {
      const message = (err as Error).message || "Failed to connect";
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
            <h1 className="text-lg font-semibold tracking-tight text-slate-100">Codex Site-Editor</h1>
            <p className="text-sm text-slate-400">Local workspace orchestrator • Backend: {serverUrl}</p>
          </div>
          <span
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium shadow-inset ${
              websocketReady ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-rose-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${websocketReady ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`}
            />
            {websocketReady ? "Connected" : "Offline"}
          </span>
        </div>

        <form
          onSubmit={handleConnect}
          className="flex w-full flex-col gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-4 shadow-surface sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Repository Path</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-inner outline-none focus:border-codex-primary focus:ring-2 focus:ring-codex-primary/40"
              placeholder="/path/to/project"
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-lg bg-codex-primary px-4 py-2 text-sm font-semibold text-white shadow-surface transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Connecting…" : repositoryPath ? "Reconnect" : "Connect"}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <BranchBadge branch={branchLabel} />
          {gitStatus && !gitStatus.isClean && (
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-200">
              {gitStatus.files.length} changes
            </span>
          )}
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
