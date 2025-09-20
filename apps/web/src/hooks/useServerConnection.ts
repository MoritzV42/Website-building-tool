import { useEffect } from "react";
import type { ServerEvent } from "../types";
import useEditorStore from "../state/useEditorStore";

export function useServerConnection() {
  const serverUrl = useEditorStore((state) => state.serverUrl);
  const wsUrl = useEditorStore((state) => state.wsUrl);
  const setRepositoryPath = useEditorStore((state) => state.setRepositoryPath);
  const upsertTask = useEditorStore((state) => state.upsertTask);
  const resetTasks = useEditorStore((state) => state.resetTasks);
  const setPatches = useEditorStore((state) => state.setPatches);
  const upsertPatch = useEditorStore((state) => state.upsertPatch);
  const appendLog = useEditorStore((state) => state.appendLog);
  const setWebsocketReady = useEditorStore((state) => state.setWebsocketReady);

  useEffect(() => {
    const socket = new WebSocket(`${wsUrl}/ws`);

    socket.addEventListener("open", () => {
      setWebsocketReady(true);
      appendLog({ level: "info", message: `Connected to backend at ${serverUrl}` });
    });

    socket.addEventListener("close", () => {
      setWebsocketReady(false);
      appendLog({ level: "warning", message: "WebSocket connection closed" });
    });

    socket.addEventListener("error", () => {
      appendLog({ level: "error", message: "WebSocket connection error" });
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data as string) as ServerEvent;
        switch (payload.type) {
          case "workspace:ready":
            setRepositoryPath(payload.repository);
            appendLog({ level: "info", message: `Workspace ready: ${payload.repository}` });
            break;
          case "task:bootstrap":
            resetTasks(payload.tasks);
            break;
          case "task:created":
          case "task:updated":
            upsertTask(payload.task);
            break;
          case "patch":
            upsertPatch(payload.patch);
            appendLog({
              level: "info",
              message: `Patch generated for ${payload.patch.file}`,
              createdAt: payload.patch.createdAt
            });
            break;
          case "patch:updated":
            upsertPatch(payload.patch);
            appendLog({
              level: "info",
              message: `Patch ${payload.patch.status} → ${payload.patch.file}`,
              createdAt: payload.patch.resolvedAt ?? Date.now()
            });
            break;
          case "patch:bootstrap":
            setPatches(payload.patches);
            break;
          case "workspace:file":
            appendLog({
              level: "info",
              message: `File ${payload.change} → ${payload.path}`
            });
            break;
        }
      } catch (error) {
        appendLog({ level: "error", message: `Failed to parse event: ${(error as Error).message}` });
      }
    });

    return () => {
      socket.close();
    };
  }, [appendLog, resetTasks, serverUrl, setPatches, setRepositoryPath, setWebsocketReady, upsertPatch, upsertTask, wsUrl]);
}
