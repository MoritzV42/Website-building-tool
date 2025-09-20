import { useTranslation } from "../hooks/useTranslation";

export function TutorialPanel() {
  const { tutorial } = useTranslation();

  return (
    <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 shadow-surface">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">{tutorial.title}</h2>
        <p className="mt-1 text-xs text-slate-400">{tutorial.intro}</p>
      </div>
      <div className="flex flex-col gap-3">
        {tutorial.sections.map((section) => (
          <div key={section.heading} className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">{section.heading}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-400">{tutorial.outro}</p>
    </section>
  );
}
