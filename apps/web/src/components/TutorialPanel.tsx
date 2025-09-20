import { useMemo } from "react";
import { useTranslation } from "../hooks/useTranslation";
import useEditorStore from "../state/useEditorStore";

export function TutorialPanel() {
  const { tutorial } = useTranslation();
  const startTutorial = useEditorStore((state) => state.startTutorial);
  const completeTutorial = useEditorStore((state) => state.completeTutorial);
  const tutorialVisible = useEditorStore((state) => state.tutorialVisible);
  const tutorialCompleted = useEditorStore((state) => state.tutorialCompleted);

  const primaryLabel = useMemo(() => {
    if (tutorialVisible) {
      return tutorial.card.start;
    }
    if (tutorialCompleted) {
      return tutorial.card.start;
    }
    return tutorial.card.start;
  }, [tutorial.card.start, tutorialCompleted, tutorialVisible]);

  const showSkip = !tutorialCompleted;

  return (
    <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 shadow-surface">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">{tutorial.card.title}</h2>
          <p className="mt-1 text-xs text-slate-400">{tutorial.card.intro}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={startTutorial}
            className="rounded-lg bg-codex-primary px-3 py-2 text-xs font-semibold text-white shadow-surface transition hover:shadow-lg"
          >
            {primaryLabel}
          </button>
          {showSkip && (
            <button
              type="button"
              onClick={completeTutorial}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-rose-400 hover:text-rose-200"
            >
              {tutorial.card.skip}
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {tutorial.card.sections.map((section) => (
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
      <p className="mt-4 text-xs text-slate-400">{tutorial.card.outro}</p>
    </section>
  );
}
