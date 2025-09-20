import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../hooks/useTranslation";
import useEditorStore from "../state/useEditorStore";

const HIGHLIGHT_PADDING = 16;
const CARD_MARGIN = 24;
const MIN_MARGIN = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function TutorialOverlay() {
  const { tutorial } = useTranslation();
  const startTutorial = useEditorStore((state) => state.startTutorial);
  const setTutorialStep = useEditorStore((state) => state.setTutorialStep);
  const completeTutorial = useEditorStore((state) => state.completeTutorial);
  const tutorialVisible = useEditorStore((state) => state.tutorialVisible);
  const tutorialStep = useEditorStore((state) => state.tutorialStep);
  const tutorialCompleted = useEditorStore((state) => state.tutorialCompleted);

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardSize, setCardSize] = useState<{ width: number; height: number }>({ width: 320, height: 240 });

  const steps = tutorial.overlay.steps;
  const totalSteps = steps.length;
  const currentStepIndex = Math.min(tutorialStep, Math.max(totalSteps - 1, 0));
  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    if (!tutorialCompleted && !tutorialVisible && steps.length > 0) {
      startTutorial();
    }
  }, [tutorialCompleted, tutorialVisible, startTutorial, steps.length]);

  useEffect(() => {
    if (!tutorialVisible || !currentStep) {
      setTargetRect(null);
      return;
    }
    const selector = `[data-tutorial-anchor="${currentStep.anchor}"]`;
    const target = document.querySelector(selector) as HTMLElement | null;
    if (!target) {
      setTargetRect(null);
      return;
    }
    const update = () => {
      setTargetRect(target.getBoundingClientRect());
    };
    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(target);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [tutorialVisible, currentStep]);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const update = () => {
      setCardSize({ width: cardRef.current?.offsetWidth ?? 320, height: cardRef.current?.offsetHeight ?? 240 });
    };
    update();
  }, [currentStepIndex, tutorialVisible]);

  useEffect(() => {
    if (!tutorialVisible) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        completeTutorial();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (currentStepIndex < totalSteps - 1) {
          setTutorialStep(currentStepIndex + 1);
        } else {
          completeTutorial();
        }
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (currentStepIndex > 0) {
          setTutorialStep(currentStepIndex - 1);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [tutorialVisible, currentStepIndex, totalSteps, setTutorialStep, completeTutorial]);

  const highlightStyle = useMemo(() => {
    if (!targetRect) return null;
    return {
      left: Math.max(targetRect.left - HIGHLIGHT_PADDING, MIN_MARGIN),
      top: Math.max(targetRect.top - HIGHLIGHT_PADDING, MIN_MARGIN),
      width: targetRect.width + HIGHLIGHT_PADDING * 2,
      height: targetRect.height + HIGHLIGHT_PADDING * 2
    };
  }, [targetRect]);

  const cardStyle = useMemo(() => {
    if (typeof window === "undefined") {
      return { left: 0, top: 0 };
    }
    if (!targetRect || !currentStep) {
      const width = cardSize.width;
      return {
        left: clamp(window.innerWidth / 2 - width / 2, MIN_MARGIN, window.innerWidth - width - MIN_MARGIN),
        top: MIN_MARGIN
      };
    }

    const width = cardSize.width;
    const height = cardSize.height;
    const centerX = targetRect.left + targetRect.width / 2;
    const centerY = targetRect.top + targetRect.height / 2;
    const maxLeft = window.innerWidth - width - MIN_MARGIN;
    const maxTop = window.innerHeight - height - MIN_MARGIN;

    switch (currentStep.placement) {
      case "top":
        return {
          left: clamp(centerX - width / 2, MIN_MARGIN, maxLeft),
          top: clamp(targetRect.top - height - CARD_MARGIN, MIN_MARGIN, maxTop)
        };
      case "bottom":
        return {
          left: clamp(centerX - width / 2, MIN_MARGIN, maxLeft),
          top: clamp(targetRect.bottom + CARD_MARGIN, MIN_MARGIN, maxTop)
        };
      case "left":
        return {
          left: clamp(targetRect.left - width - CARD_MARGIN, MIN_MARGIN, maxLeft),
          top: clamp(centerY - height / 2, MIN_MARGIN, maxTop)
        };
      case "right":
      default:
        return {
          left: clamp(targetRect.right + CARD_MARGIN, MIN_MARGIN, maxLeft),
          top: clamp(centerY - height / 2, MIN_MARGIN, maxTop)
        };
    }
  }, [targetRect, currentStep, cardSize]);

  if (typeof document === "undefined" || !tutorialVisible || !currentStep) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[2000]">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      {highlightStyle && (
        <div
          className="pointer-events-none absolute rounded-2xl border border-codex-primary/40 shadow-[0_0_0_2px_rgba(108,92,231,0.35),0_20px_40px_rgba(12,15,25,0.7)]"
          style={highlightStyle}
        />
      )}
      <div className="absolute" style={cardStyle} ref={cardRef}>
        <div className="flex w-[min(360px,calc(100vw-48px))] flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/95 p-5 text-slate-100 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-codex-primary/80">
                {tutorial.overlay.progress(currentStepIndex + 1, totalSteps)}
              </p>
              <h3 className="mt-2 text-base font-semibold text-white">{currentStep.heading}</h3>
              <p className="mt-2 text-sm text-slate-300">{currentStep.description}</p>
            </div>
            <button
              type="button"
              onClick={completeTutorial}
              className="text-xs font-semibold text-slate-400 transition hover:text-rose-300"
            >
              {tutorial.overlay.skip}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setTutorialStep(Math.max(currentStepIndex - 1, 0))}
              disabled={currentStepIndex === 0}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-400 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tutorial.overlay.back}
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentStepIndex === totalSteps - 1) {
                  completeTutorial();
                } else {
                  setTutorialStep(currentStepIndex + 1);
                }
              }}
              className="rounded-lg bg-codex-primary px-3 py-2 text-xs font-semibold text-white shadow-surface transition hover:shadow-lg"
            >
              {currentStepIndex === totalSteps - 1 ? tutorial.overlay.finish : tutorial.overlay.next}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
