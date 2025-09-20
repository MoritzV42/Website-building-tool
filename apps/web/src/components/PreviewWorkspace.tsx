import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildStableSelector } from "../lib/selectors";
import useEditorStore from "../state/useEditorStore";

function formatSelectorLabel(selector: string) {
  return selector.length > 72 ? `${selector.slice(0, 72)}…` : selector;
}

export function PreviewWorkspace() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const hoverOverlayRef = useRef<HTMLDivElement | null>(null);
  const selectionOverlayRef = useRef<HTMLDivElement | null>(null);

  const previewHtml = useEditorStore((state) => state.previewHtml);
  const isPickerActive = useEditorStore((state) => state.isPickerActive);
  const setPickerActive = useEditorStore((state) => state.setPickerActive);
  const selectedSelector = useEditorStore((state) => state.selectedSelector);
  const setSelectedSelector = useEditorStore((state) => state.setSelectedSelector);
  const patches = useEditorStore((state) => state.patches);

  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const latestPatch = patches[0];

  const ensureOverlays = useCallback((doc: Document) => {
    if (!hoverOverlayRef.current) {
      const hoverOverlay = doc.createElement("div");
      hoverOverlay.style.position = "absolute";
      hoverOverlay.style.pointerEvents = "none";
      hoverOverlay.style.border = "2px solid rgba(108, 92, 231, 0.9)";
      hoverOverlay.style.borderRadius = "12px";
      hoverOverlay.style.boxShadow = "0 0 0 2px rgba(108, 92, 231, 0.3)";
      hoverOverlay.style.zIndex = "2147483646";
      hoverOverlay.style.display = "none";
      doc.body.appendChild(hoverOverlay);
      hoverOverlayRef.current = hoverOverlay;
    }
    if (!selectionOverlayRef.current) {
      const selectionOverlay = doc.createElement("div");
      selectionOverlay.style.position = "absolute";
      selectionOverlay.style.pointerEvents = "none";
      selectionOverlay.style.border = "2px solid rgba(94, 234, 212, 0.9)";
      selectionOverlay.style.borderRadius = "12px";
      selectionOverlay.style.boxShadow = "0 0 0 2px rgba(94, 234, 212, 0.25)";
      selectionOverlay.style.zIndex = "2147483645";
      selectionOverlay.style.display = "none";
      doc.body.appendChild(selectionOverlay);
      selectionOverlayRef.current = selectionOverlay;
    }
  }, []);

  useEffect(() => {
    const iframe = frameRef.current;
    if (!iframe) return;

    let doc: Document | null = null;

    const updateHoverOverlay = (element: Element | null) => {
      if (!doc || !hoverOverlayRef.current) return;
      if (!element || !isPickerActive) {
        hoverOverlayRef.current.style.display = "none";
        setHoverLabel(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      const scrollX = doc.defaultView?.scrollX ?? 0;
      const scrollY = doc.defaultView?.scrollY ?? 0;
      hoverOverlayRef.current.style.display = "block";
      hoverOverlayRef.current.style.left = `${rect.left + scrollX}px`;
      hoverOverlayRef.current.style.top = `${rect.top + scrollY}px`;
      hoverOverlayRef.current.style.width = `${rect.width}px`;
      hoverOverlayRef.current.style.height = `${rect.height}px`;
      const selector = buildStableSelector(element);
      setHoverLabel(selector);
    };

    const updateSelectionOverlay = (selector: string | null) => {
      if (!doc || !selectionOverlayRef.current) return;
      if (!selector) {
        selectionOverlayRef.current.style.display = "none";
        return;
      }
      const target = doc.querySelector(selector);
      if (!target) {
        selectionOverlayRef.current.style.display = "none";
        return;
      }
      const rect = target.getBoundingClientRect();
      const scrollX = doc.defaultView?.scrollX ?? 0;
      const scrollY = doc.defaultView?.scrollY ?? 0;
      selectionOverlayRef.current.style.display = "block";
      selectionOverlayRef.current.style.left = `${rect.left + scrollX}px`;
      selectionOverlayRef.current.style.top = `${rect.top + scrollY}px`;
      selectionOverlayRef.current.style.width = `${rect.width}px`;
      selectionOverlayRef.current.style.height = `${rect.height}px`;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isPickerActive) return;
      const target = event.target as Element | null;
      if (!target || target === doc?.body || target === doc?.documentElement) {
        updateHoverOverlay(null);
        return;
      }
      event.preventDefault();
      updateHoverOverlay(target);
    };

    const handleClick = (event: MouseEvent) => {
      if (!isPickerActive) return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.target as Element | null;
      if (!target) return;
      const selector = buildStableSelector(target);
      setSelectedSelector(selector);
      updateSelectionOverlay(selector);
      setPickerActive(false);
      setHoverLabel(null);
    };

    const handleMouseLeave = () => {
      updateHoverOverlay(null);
    };

    const attachListeners = () => {
      doc = iframe.contentDocument;
      if (!doc) return;
      ensureOverlays(doc);
      doc.addEventListener("mousemove", handleMouseMove, true);
      doc.addEventListener("click", handleClick, true);
      doc.addEventListener("mouseleave", handleMouseLeave, true);
      updateSelectionOverlay(selectedSelector);
    };

    if (iframe.contentDocument?.readyState === "complete") {
      attachListeners();
    } else {
      iframe.addEventListener("load", attachListeners);
    }

    return () => {
      iframe.removeEventListener("load", attachListeners);
      if (doc) {
        doc.removeEventListener("mousemove", handleMouseMove, true);
        doc.removeEventListener("click", handleClick, true);
        doc.removeEventListener("mouseleave", handleMouseLeave, true);
      }
      hoverOverlayRef.current?.remove();
      hoverOverlayRef.current = null;
      selectionOverlayRef.current?.remove();
      selectionOverlayRef.current = null;
    };
  }, [ensureOverlays, isPickerActive, selectedSelector, setPickerActive, setSelectedSelector, iframeKey]);

  useEffect(() => {
    const iframe = frameRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;
    ensureOverlays(doc);
    if (selectedSelector) {
      const target = doc.querySelector(selectedSelector);
      if (target) {
        const rect = target.getBoundingClientRect();
        const scrollX = doc.defaultView?.scrollX ?? 0;
        const scrollY = doc.defaultView?.scrollY ?? 0;
        if (selectionOverlayRef.current) {
          selectionOverlayRef.current.style.display = "block";
          selectionOverlayRef.current.style.left = `${rect.left + scrollX}px`;
          selectionOverlayRef.current.style.top = `${rect.top + scrollY}px`;
          selectionOverlayRef.current.style.width = `${rect.width}px`;
          selectionOverlayRef.current.style.height = `${rect.height}px`;
        }
      }
    } else if (selectionOverlayRef.current) {
      selectionOverlayRef.current.style.display = "none";
    }
  }, [ensureOverlays, selectedSelector, iframeKey]);

  const previewTitle = useMemo(() => {
    if (!selectedSelector) return "Live Preview";
    return `Live Preview • ${selectedSelector}`;
  }, [selectedSelector]);

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">{previewTitle}</h2>
          <p className="text-xs text-slate-400">
            Hover to inspect the preview. Activate the picker to capture a stable selector.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPickerActive(!isPickerActive)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-surface transition ${
              isPickerActive
                ? "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/25"
                : "bg-slate-800/70 text-slate-100 hover:bg-slate-700/70"
            }`}
          >
            {isPickerActive ? "Picking… click element" : "Element Picker"}
          </button>
          <button
            type="button"
            onClick={() => setIframeKey((prev) => prev + 1)}
            className="rounded-lg bg-slate-800/70 px-4 py-2 text-sm font-semibold text-slate-100 shadow-surface hover:bg-slate-700/70"
          >
            Refresh Preview
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/5 bg-slate-950/60 shadow-surface">
        <iframe
          key={iframeKey}
          ref={frameRef}
          srcDoc={previewHtml}
          title="Preview"
          className="h-full w-full"
          sandbox="allow-scripts allow-same-origin"
        />
        {(hoverLabel || selectedSelector) && (
          <div className="pointer-events-none absolute bottom-4 right-4 max-w-[60%] rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-slate-200 shadow-lg">
            <p className="font-semibold text-slate-100">{hoverLabel ? "Hover" : "Selected"}</p>
            <p className="truncate text-slate-300" title={hoverLabel ?? selectedSelector ?? undefined}>
              {formatSelectorLabel(hoverLabel ?? selectedSelector ?? "")}
            </p>
          </div>
        )}
      </div>

      {latestPatch && (
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 shadow-surface">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>Latest Patch • {latestPatch.file}</span>
            <span>{new Date(latestPatch.createdAt).toLocaleTimeString()}</span>
          </div>
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950/70 p-3 text-xs text-slate-200">
            <code>{latestPatch.diff}</code>
          </pre>
        </div>
      )}
    </section>
  );
}
