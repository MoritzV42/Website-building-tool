import bodyParser from "body-parser";
import chokidar, { FSWatcher } from "chokidar";
import cors from "cors";
import { createServer } from "http";
import path from "node:path";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import express from "express";
import { simpleGit } from "simple-git";
import { WebSocketServer, WebSocket } from "ws";
import { createTwoFilesPatch } from "diff";
import { randomUUID } from "node:crypto";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;

interface TaskRequest {
  selector: string;
  goal: string;
  files?: string[];
  context?: Record<string, unknown>;
}

type TaskStatus = "pending" | "processing" | "completed" | "failed";

interface Task extends TaskRequest {
  id: string;
  createdAt: number;
  status: TaskStatus;
  error?: string;
}

interface PatchEvent {
  id: string;
  taskId: string;
  file: string;
  diff: string;
  note?: string;
  createdAt: number;
}

type ServerEvent =
  | { type: "task:created"; task: Task }
  | { type: "task:updated"; task: Task }
  | { type: "patch"; patch: PatchEvent }
  | { type: "workspace:file"; path: string; change: "add" | "change" | "unlink" }
  | { type: "workspace:ready"; repository: string }
  | { type: "task:bootstrap"; tasks: Task[] };

class WorkspaceManager {
  private repoPath: string;
  private readonly shadowPath: string;
  private watcher?: FSWatcher;
  private readonly watcherHandlers: Array<(event: ServerEvent) => void> = [];

  constructor(initialPath: string) {
    this.repoPath = initialPath;
    this.shadowPath = path.join(process.cwd(), ".codex-shadow");
    fs.mkdirSync(this.shadowPath, { recursive: true });
  }

  getRepositoryPath() {
    return this.repoPath;
  }

  getShadowPath() {
    return this.shadowPath;
  }

  async setRepositoryPath(newPath: string) {
    const resolved = path.resolve(newPath);
    const stats = await fsp.stat(resolved);
    if (!stats.isDirectory()) {
      throw new Error(`Repository path ${resolved} is not a directory`);
    }
    this.repoPath = resolved;
    fs.mkdirSync(this.shadowPath, { recursive: true });
    await this.refreshWatcher();
    return this.repoPath;
  }

  async refreshWatcher() {
    if (this.watcher) {
      await this.watcher.close();
    }
    this.watcher = chokidar.watch([path.join(this.repoPath, "**/*")], {
      ignoreInitial: true,
      ignored: ["**/node_modules/**", "**/.git/**", this.shadowPath]
    });
    for (const handler of this.watcherHandlers) {
      this.attachWatcher(handler);
    }
  }

  async getGitStatus() {
    const git = simpleGit({ baseDir: this.repoPath });
    const status = await git.status();
    return {
      current: status.current,
      tracking: status.tracking,
      files: status.files,
      ahead: status.ahead,
      behind: status.behind,
      isClean: status.isClean()
    };
  }

  onWatcherEvent(handler: (event: ServerEvent) => void) {
    this.watcherHandlers.push(handler);
    this.attachWatcher(handler);
  }

  private attachWatcher(handler: (event: ServerEvent) => void) {
    this.watcher?.on("add", (filePath) => {
      handler({ type: "workspace:file", path: filePath, change: "add" });
    });
    this.watcher?.on("change", (filePath) => {
      handler({ type: "workspace:file", path: filePath, change: "change" });
    });
    this.watcher?.on("unlink", (filePath) => {
      handler({ type: "workspace:file", path: filePath, change: "unlink" });
    });
  }

  async writeShadowFile(relative: string, content: string) {
    const destination = path.join(this.shadowPath, relative);
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await fsp.writeFile(destination, content, "utf8");
  }

  async readSourceFile(relative: string) {
    const source = path.join(this.repoPath, relative);
    try {
      return await fsp.readFile(source, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return "";
      }
      throw error;
    }
  }
}

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
const clients = new Set<WebSocket>();
const workspace = new WorkspaceManager(process.cwd());
const tasks: Task[] = [];

app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));

workspace.onWatcherEvent((event) => broadcast(event));
void workspace.refreshWatcher();

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/repository", async (req, res) => {
  const repoPath = req.body?.path;
  if (!repoPath || typeof repoPath !== "string") {
    res.status(400).json({ error: "Missing repository path" });
    return;
  }
  try {
    const resolved = await workspace.setRepositoryPath(repoPath);
    broadcast({ type: "workspace:ready", repository: resolved });
    res.json({ repository: resolved });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/repository/status", async (_req, res) => {
  try {
    const status = await workspace.getGitStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/api/tasks", (_req, res) => {
  res.json(tasks);
});

app.post("/api/tasks", async (req, res) => {
  const payload = req.body as TaskRequest;
  if (!payload?.selector || !payload?.goal) {
    res.status(400).json({ error: "selector and goal are required" });
    return;
  }
  const task: Task = {
    id: randomUUID(),
    selector: payload.selector,
    goal: payload.goal,
    files: payload.files,
    context: payload.context,
    createdAt: Date.now(),
    status: "pending"
  };
  tasks.push(task);
  broadcast({ type: "task:created", task });
  processTask(task).catch((error) => {
    task.status = "failed";
    task.error = (error as Error).message;
    broadcast({ type: "task:updated", task });
  });
  res.json(task);
});

wss.on("connection", (socket) => {
  clients.add(socket);
  socket.on("close", () => clients.delete(socket));
  socket.send(JSON.stringify({ type: "workspace:ready", repository: workspace.getRepositoryPath() } satisfies ServerEvent));
  socket.send(JSON.stringify({ type: "task:bootstrap", tasks }));
});

function broadcast(event: ServerEvent) {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

async function processTask(task: Task) {
  task.status = "processing";
  broadcast({ type: "task:updated", task });

  const file = task.files?.[0] ?? "src/App.tsx";
  const original = await workspace.readSourceFile(file);
  const mutated = synthesizeChange(original, task);
  const diff = createTwoFilesPatch(file, file, original, mutated, "", "");

  await workspace.writeShadowFile(file, mutated);

  const patch: PatchEvent = {
    id: randomUUID(),
    taskId: task.id,
    file,
    diff,
    note: `Applied goal: ${task.goal}`,
    createdAt: Date.now()
  };
  broadcast({ type: "patch", patch });

  task.status = "completed";
  broadcast({ type: "task:updated", task });
}

function synthesizeChange(source: string, task: Task) {
  const banner = `// codex-task: ${task.goal}\n`;
  if (!source) {
    return `${banner}export const placeholder = () => null;\n`;
  }
  if (source.includes("// codex-task:")) {
    return source.replace(/\/\/ codex-task: .*\n/, banner);
  }
  return `${banner}${source}`;
}

httpServer.listen(PORT, () => {
  console.log(`Codex backend listening on http://localhost:${PORT}`);
});
