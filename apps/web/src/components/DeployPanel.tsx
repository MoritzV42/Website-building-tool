import { useTranslation } from "../hooks/useTranslation";

const NETLIFY_GUIDE_URL = "https://docs.netlify.com/site-deploys/create-deploys/";

export function DeployPanel() {
  const { deployPanel } = useTranslation();

  return (
    <section className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 shadow-surface">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">{deployPanel.title}</h2>
          <p className="mt-1 text-xs text-slate-400">{deployPanel.description}</p>
        </div>
        <a
          href={NETLIFY_GUIDE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-codex-primary/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-codex-primary transition hover:bg-codex-primary/10"
        >
          {deployPanel.button}
        </a>
      </div>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs text-slate-300">
        {deployPanel.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-slate-500">{deployPanel.helper}</p>
    </section>
  );
}
