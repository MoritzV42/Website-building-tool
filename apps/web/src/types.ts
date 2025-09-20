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

export interface PatchEvent {
  id: string;
  taskId: string;
  file: string;
  diff: string;
  note?: string;
  createdAt: number;
}

export type WorkspaceFileChange = "add" | "change" | "unlink";

export type ServerEvent =
  | { type: "task:created"; task: Task }
  | { type: "task:updated"; task: Task }
  | { type: "patch"; patch: PatchEvent }
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
