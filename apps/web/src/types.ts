export type TaskStatus = "pending" | "processing" | "completed" | "failed";

export interface Task {
  id: string;
  selector: string;
  goal: string;
  files?: string[];
  context?: Record<string, unknown>;
  createdAt: number;
  status: TaskStatus;
  error?: string;
}

export type PatchStatus = "pending" | "applied" | "discarded" | "reverted";

export interface PatchEvent {
  id: string;
  taskId: string;
  file: string;
  diff: string;
  note?: string;
  createdAt: number;
  status: PatchStatus;
  resolvedAt: number | null;
  appliedAt: number | null;
}

export type WorkspaceFileChange = "add" | "change" | "unlink";

export type ServerEvent =
  | { type: "task:created"; task: Task }
  | { type: "task:updated"; task: Task }
  | { type: "patch"; patch: PatchEvent }
  | { type: "patch:updated"; patch: PatchEvent }
  | { type: "patch:bootstrap"; patches: PatchEvent[] }
  | { type: "workspace:file"; path: string; change: WorkspaceFileChange }
  | { type: "workspace:ready"; repository: string }
  | { type: "task:bootstrap"; tasks: Task[] };

export interface GitStatusSummary {
  current?: string;
  tracking?: string;
  files: Array<{ path: string; index: string; working_dir: string }>;
  ahead: number;
  behind: number;
  isClean: boolean;
}

export interface ChangeLogEntry {
  id: string;
  message: string;
  createdAt: number;
  level: "info" | "warning" | "error";
}

export interface OpenAiStatus {
  connected: boolean;
  method: "cli" | "apiKey" | null;
  label: string | null;
  maskedKey: string | null;
  profile: string | null;
  updatedAt: number | null;
}
