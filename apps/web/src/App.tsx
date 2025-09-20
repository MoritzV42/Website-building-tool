import { useEffect } from "react";
import { ChangeFeed } from "./components/ChangeFeed";
import { PreviewWorkspace } from "./components/PreviewWorkspace";
import { TaskComposer } from "./components/TaskComposer";
import { TopBar } from "./components/TopBar";
import { TutorialOverlay } from "./components/TutorialOverlay";
import { useServerConnection } from "./hooks/useServerConnection";
import { fetchGitStatus, fetchOpenAiStatus, fetchTasks } from "./services/api";
import useEditorStore from "./state/useEditorStore";

function App() {
  useServerConnection();
  const repositoryPath = useEditorStore((state) => state.repositoryPath);
  const setGitStatus = useEditorStore((state) => state.setGitStatus);
  const resetTasks = useEditorStore((state) => state.resetTasks);
  const appendLog = useEditorStore((state) => state.appendLog);
  const setOpenAiStatus = useEditorStore((state) => state.setOpenAiStatus);

  useEffect(() => {
    let cancelled = false;
    if (!repositoryPath) return;

    (async () => {
      try {
        const [status, tasks] = await Promise.all([fetchGitStatus(), fetchTasks()]);
        if (cancelled) return;
        setGitStatus(status);
        resetTasks(tasks);
      } catch (error) {
        appendLog({ level: "warning", message: (error as Error).message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appendLog, repositoryPath, resetTasks, setGitStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchOpenAiStatus();
        if (cancelled) return;
        setOpenAiStatus(status);
      } catch (error) {
        appendLog({ level: "warning", message: (error as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appendLog, setOpenAiStatus]);

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(54,65,98,0.6),_rgba(15,23,42,1))] text-slate-100">
      <TutorialOverlay />
      <TopBar />
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-6 py-6 lg:flex-row">
        <div className="w-full lg:w-80">
          <TaskComposer />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <PreviewWorkspace />
        </div>
        <div className="w-full lg:w-96">
          <ChangeFeed />
        </div>
      </main>
    </div>
  );
}

export default App;
