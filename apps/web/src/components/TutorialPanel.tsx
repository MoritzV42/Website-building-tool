import { useTranslation } from "../hooks/useTranslation";
import useEditorStore from "../state/useEditorStore";

export function TutorialPanel() {
  const { tutorial } = useTranslation();
  const startTutorial = useEditorStore((state) => state.startTutorial);
  const completeTutorial = useEditorStore((state) => state.completeTutorial);
  const tutorialCompleted = useEditorStore((state) => state.tutorialCompleted);
  const tutorialCollapsed = useEditorStore((state) => state.tutorialCollapsed);
  const setTutorialCollapsed = useEditorStore((state) => state.setTutorialCollapsed);

  const toggleCollapsed = () => setTutorialCollapsed(!tutorialCollapsed);
  const showSkip = !tutorialCompleted;

  return (
    <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 shadow-surface">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={toggleCollapsed}
        aria-expanded={!tutorialCollapsed}
        aria-controls="tutorial-panel-content"
      >
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">{tutorial.card.title}</h2>
          {tutorialCollapsed && <p className="mt-1 text-xs text-slate-500">{tutorial.card.intro}</p>}
        </div>
        <svg
          className={`h-3 w-3 text-slate-400 transition-transform ${tutorialCollapsed ? "" : "rotate-180"}`}
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {!tutorialCollapsed && (
        <div id="tutorial-panel-content" className="mt-4">
          <p className="text-xs text-slate-400">{tutorial.card.intro}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startTutorial}
              className="rounded-lg bg-codex-primary px-3 py-2 text-xs font-semibold text-white shadow-surface transition hover:shadow-lg"
            >
              {tutorial.card.start}
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
          <div className="mt-4 flex flex-col gap-3">
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
        </div>
      )}
    </section>
  );
}
