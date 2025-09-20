import type { GitStatusSummary, OpenAiStatus, Task } from "../types";
import useEditorStore from "../state/useEditorStore";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { serverUrl } = useEditorStore.getState();
  const response = await fetch(`${serverUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return (await response.json()) as T;
}

export async function connectRepository(path: string) {
  return request<{ repository: string }>("/api/repository", {
    method: "POST",
    body: JSON.stringify({ path })
  });
}

export async function fetchGitStatus() {
  return request<GitStatusSummary>("/api/repository/status");
}

export async function createTask(task: Pick<Task, "selector" | "goal"> & { files?: string[] }) {
  return request<Task>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(task)
  });
}

export async function fetchTasks() {
  return request<Task[]>("/api/tasks");
}

export async function selectRepositoryDirectory() {
  const response = await request<{ path: string | null }>("/api/system/select-directory", { method: "POST" });
  return response.path;
}

export async function fetchOpenAiStatus() {
  return request<OpenAiStatus>("/api/settings/openai");
}

export async function loginWithOpenAi(profile?: string) {
  return request<OpenAiStatus>("/api/settings/openai/login", {
    method: "POST",
    body: JSON.stringify(profile ? { profile } : {})
  });
}

export async function disconnectOpenAi() {
  return request<OpenAiStatus>("/api/settings/openai", {
    method: "DELETE"
  });
}
