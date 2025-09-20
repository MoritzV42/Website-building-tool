import { create } from "zustand";
import { samplePreviewHtml } from "../data/samplePreview";
import type { Language } from "../data/translations";
import type { ChangeLogEntry, GitStatusSummary, PatchEvent, Task } from "../types";

const DEFAULT_SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:8787";

const DEFAULT_LANGUAGE: Language =
  typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("de")
    ? "de"
    : "en";

interface EditorState {
  language: Language;
  serverUrl: string;
  wsUrl: string;
  repositoryPath: string | null;
  gitStatus: GitStatusSummary | null;
  tasks: Task[];
  patches: PatchEvent[];
  logs: ChangeLogEntry[];
  selectedTaskId: string | null;
  selectedSelector: string | null;
  isPickerActive: boolean;
  previewHtml: string;
  websocketReady: boolean;
  setLanguage(language: Language): void;
  setServerUrl(url: string): void;
  setRepositoryPath(path: string | null): void;
  setGitStatus(status: GitStatusSummary | null): void;
  upsertTask(task: Task): void;
  resetTasks(tasks: Task[]): void;
  pushPatch(patch: PatchEvent): void;
  appendLog(entry: Omit<ChangeLogEntry, "id" | "createdAt"> & { id?: string; createdAt?: number }): void;
  setSelectedTask(id: string | null): void;
  setSelectedSelector(selector: string | null): void;
  setPickerActive(active: boolean): void;
  setPreviewHtml(html: string): void;
  setWebsocketReady(ready: boolean): void;
}

export const useEditorStore = create<EditorState>((set) => ({
  language: DEFAULT_LANGUAGE,
  serverUrl: DEFAULT_SERVER_URL,
  wsUrl: DEFAULT_SERVER_URL.replace(/^http/, "ws"),
  repositoryPath: null,
  gitStatus: null,
  tasks: [],
  patches: [],
  logs: [],
  selectedTaskId: null,
  selectedSelector: null,
  isPickerActive: false,
  previewHtml: samplePreviewHtml,
  websocketReady: false,
  setLanguage: (language) => set({ language }),
  setServerUrl: (url) => {
    set({
      serverUrl: url,
      wsUrl: url.replace(/^http/, "ws")
    });
  },
  setRepositoryPath: (path) => set({ repositoryPath: path }),
  setGitStatus: (status) => set({ gitStatus: status }),
  upsertTask: (task) =>
    set((state) => {
      const exists = state.tasks.some((item) => item.id === task.id);
      return {
        tasks: exists
          ? state.tasks.map((item) => (item.id === task.id ? task : item))
          : [...state.tasks, task]
      };
    }),
  resetTasks: (tasks) => set({ tasks }),
  pushPatch: (patch) =>
    set((state) => ({ patches: [patch, ...state.patches].slice(0, 25) })),
  appendLog: ({ id, createdAt, ...rest }) =>
    set((state) => ({
      logs: [
        {
          id:
            id ??
            (typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2)),
          createdAt: createdAt ?? Date.now(),
          ...rest
        },
        ...state.logs
      ].slice(0, 50)
    })),
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  setSelectedSelector: (selector) => set({ selectedSelector: selector }),
  setPickerActive: (active) => set({ isPickerActive: active }),
  setPreviewHtml: (html) => set({ previewHtml: html }),
  setWebsocketReady: (ready) => set({ websocketReady: ready })
}));

export default useEditorStore;
