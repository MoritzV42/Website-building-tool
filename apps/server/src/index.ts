import bodyParser from "body-parser";
import chokidar, { FSWatcher } from "chokidar";
import cors from "cors";
import { createServer, Server } from "http";
import path from "node:path";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import { pathToFileURL } from "node:url";
import express from "express";
import { simpleGit } from "simple-git";
import { WebSocketServer, WebSocket } from "ws";
import { createTwoFilesPatch } from "diff";
import { randomUUID } from "node:crypto";

const DEFAULT_PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const DEFAULT_ENV_PATH = process.env.CODEX_ENV_PATH
  ? path.resolve(process.env.CODEX_ENV_PATH)
  : path.resolve(process.cwd(), "..", "..", ".env");
const DEFAULT_METADATA_PATH = process.env.CODEX_OPENAI_METADATA
  ? path.resolve(process.env.CODEX_OPENAI_METADATA)
  : path.join(path.dirname(DEFAULT_ENV_PATH), "openai-status.json");
const DEFAULT_SHADOW_PATH = process.env.CODEX_SHADOW_PATH
  ? path.resolve(process.env.CODEX_SHADOW_PATH)
  : path.join(process.cwd(), ".codex-shadow");

const SERVER_CWD = process.env.CODEX_SERVER_CWD ? path.resolve(process.env.CODEX_SERVER_CWD) : process.cwd();
const OPENAI_CLI_BIN = process.platform === "win32" ? "openai.cmd" : "openai";

let currentEnvPath = DEFAULT_ENV_PATH;
let currentMetadataPath = DEFAULT_METADATA_PATH;

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

  constructor(initialPath: string, shadowRoot: string = DEFAULT_SHADOW_PATH) {
    this.repoPath = initialPath;
    this.shadowPath = path.resolve(shadowRoot);
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

interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

async function runCommand(command: string, args: string[], options: CommandOptions = {}) {
  return await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      cwd: options.cwd,
      env: options.env
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 0 });
    });
  });
}

async function openDirectoryPicker(): Promise<string | null> {
  const platform = process.platform;

  if (platform === "win32") {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "$shell = New-Object -ComObject Shell.Application",
      "$folder = $shell.BrowseForFolder(0, 'Wähle den Root-Ordner deines Git-Repositories', 0, 0)",
      "if ($folder) { [Console]::Out.WriteLine($folder.Self.Path) }"
    ].join("; ");

    try {
      const { stdout, exitCode, stderr } = await runCommand("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script
      ]);
      if (exitCode !== 0) {
        throw new Error(stderr || "Directory picker was cancelled");
      }
      const output = stdout.trim();
      return output || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error("PowerShell wurde nicht gefunden. Bitte Pfad manuell eintragen.");
      }
      if (error instanceof Error && (/Bin[aä]rdat/i.test(error.message) || /Binary data/i.test(error.message))) {
        throw new Error(
          "Windows konnte den Ordnerdialog nicht öffnen. Bitte starte Codex in einer klassischen PowerShell (x64) oder gib den Pfad manuell ein."
        );
      }
      throw error;
    }
  }

  if (platform === "darwin") {
    const script = "POSIX path of (choose folder with prompt \"Select the root of your Git repository for Codex\")";
    try {
      const { stdout, exitCode, stderr } = await runCommand("osascript", ["-e", script]);
      if (exitCode !== 0) {
        if (stderr.includes("User canceled")) {
          return null;
        }
        throw new Error(stderr || "Directory picker failed");
      }
      return stdout || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error("osascript ist nicht verfügbar. Bitte Pfad manuell eintragen.");
      }
      throw error;
    }
  }

  if (platform === "linux") {
    try {
      const { stdout, exitCode, stderr } = await runCommand("zenity", [
        "--file-selection",
        "--directory",
        "--title=Select the root of your Git repository",
      ]);
      if (exitCode !== 0) {
        if (!stderr) {
          return null;
        }
        throw new Error(stderr);
      }
      return stdout || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error("Zenity ist nicht installiert. Bitte Pfad manuell eintragen.");
      }
      throw error;
    }
  }

  throw new Error(`Directory picker is not supported on ${platform}`);
}

interface OpenAiMetadata {
  method: "cli" | "apiKey";
  profile?: string;
  updatedAt: number;
}

function formatOpenAiStatus(apiKey: string | null, metadata: OpenAiMetadata | null) {
  if (!apiKey) {
    return { connected: false, method: null, label: null, maskedKey: null, profile: null, updatedAt: null };
  }
  const trimmed = apiKey.trim();
  const visible = trimmed.slice(-4);
  const masked = `${"•".repeat(Math.max(trimmed.length - 4, 0))}${visible}`;
  const method = metadata?.method ?? "apiKey";
  const label = method === "cli" ? `GPT Login${metadata?.profile ? ` (${metadata.profile})` : ""}` : "Manual key";
  return {
    connected: true,
    method,
    label,
    maskedKey: masked,
    profile: metadata?.profile ?? null,
    updatedAt: metadata?.updatedAt ?? null
  };
}

async function readOpenAiMetadata(): Promise<OpenAiMetadata | null> {
  try {
    const content = await fsp.readFile(currentMetadataPath, "utf8");
    return JSON.parse(content) as OpenAiMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeOpenAiMetadata(value: OpenAiMetadata | null) {
  try {
    if (!value) {
      await fsp.unlink(currentMetadataPath);
      return;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  if (!value) {
    return;
  }

  await fsp.mkdir(path.dirname(currentMetadataPath), { recursive: true });
  await fsp.writeFile(currentMetadataPath, JSON.stringify(value, null, 2), "utf8");
}

async function readOpenAiKey(): Promise<string | null> {
  try {
    const content = await fsp.readFile(currentEnvPath, "utf8");
    const line = content
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith("OPENAI_API_KEY="));
    if (!line) {
      return null;
    }
    return line.slice("OPENAI_API_KEY=".length).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeOpenAiKey(value: string | null) {
  const normalized = value ?? "";
  let content = "";
  try {
    content = await fsp.readFile(currentEnvPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const pattern = /^OPENAI_API_KEY=.*$/m;
  if (normalized) {
    if (pattern.test(content)) {
      content = content.replace(pattern, `OPENAI_API_KEY=${normalized}`);
    } else {
      content = `${content.trimEnd() ? `${content.trimEnd()}\n` : ""}OPENAI_API_KEY=${normalized}\n`;
    }
  } else if (pattern.test(content)) {
    content = content.replace(pattern, "");
    content = content
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "")
      .join("\n");
    if (content) {
      content = `${content}\n`;
    }
  }

  await fsp.mkdir(path.dirname(currentEnvPath), { recursive: true });
  await fsp.writeFile(currentEnvPath, content, "utf8");
}

function resolveOpenAiCliPath() {
  const overrides = process.env.CODEX_OPENAI_CLI ? [path.resolve(process.env.CODEX_OPENAI_CLI)] : [];
  const candidates = [
    ...overrides,
    path.join(SERVER_CWD, "node_modules", ".bin", OPENAI_CLI_BIN),
    path.join(path.resolve(SERVER_CWD, ".."), "node_modules", ".bin", OPENAI_CLI_BIN),
    path.join(path.resolve(SERVER_CWD, "..", ".."), "node_modules", ".bin", OPENAI_CLI_BIN)
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    "OpenAI CLI wurde nicht gefunden. Installiere das npm-Paket 'openai' (lokal oder im Desktop-Workspace) oder setze CODEX_OPENAI_CLI auf den Pfad."
  );
}

function extractCliApiKey(config: string, profile: string) {
  const lines = config.split(/\r?\n/);
  let inSection = false;
  let sectionIndent = 0;
  for (const line of lines) {
    if (!inSection) {
      const match = line.match(/^(\s*)([\w-]+):\s*$/);
      if (match && match[2] === profile) {
        inSection = true;
        sectionIndent = match[1].length;
      }
      continue;
    }

    const indent = (line.match(/^(\s*)/)?.[1].length ?? 0);
    if (indent <= sectionIndent && line.trim()) {
      const match = line.match(/^(\s*)([\w-]+):\s*$/);
      if (match && match[2] === profile) {
        sectionIndent = match[1].length;
        continue;
      }
      inSection = false;
      if (!match) {
        continue;
      }
    }

    if (!inSection) {
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("api_key:")) {
      const rawValue = trimmed.slice("api_key:".length).trim();
      return rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
  return null;
}

async function readOpenAiCliKey(profile: string) {
  const overrides = process.env.CODEX_OPENAI_CONFIG ? [path.resolve(process.env.CODEX_OPENAI_CONFIG)] : [];
  const roaming = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
  const candidates = [
    ...overrides,
    path.join(os.homedir(), ".config", "openai", "config.yaml"),
    path.join(os.homedir(), "Library", "Application Support", "openai", "config.yaml"),
    path.join(roaming, "openai", "config.yaml")
  ];

  const visited = new Set<string>();
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (visited.has(resolved)) {
      continue;
    }
    visited.add(resolved);
    try {
      const content = await fsp.readFile(resolved, "utf8");
      const key = extractCliApiKey(content, profile);
      if (key) {
        return key;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
  return null;
}

async function loginWithOpenAiCli(profile: string) {
  const cliPath = resolveOpenAiCliPath();
  const args = ["login"];
  if (profile && profile !== "default") {
    args.push("--profile", profile);
  }
  const { exitCode, stderr, stdout } = await runCommand(cliPath, args, { cwd: SERVER_CWD, env: process.env });
  if (exitCode !== 0) {
    throw new Error(stderr || stdout || "OpenAI-Login fehlgeschlagen.");
  }
  const key = await readOpenAiCliKey(profile);
  if (!key) {
    throw new Error(
      "Die Anmeldung wurde abgeschlossen, aber es wurde kein API-Schlüssel gefunden. Bitte versuche es erneut oder lege den Schlüssel manuell fest."
    );
  }
  return key;
}

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
const clients = new Set<WebSocket>();
const workspace = new WorkspaceManager(SERVER_CWD, DEFAULT_SHADOW_PATH);
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

app.post("/api/system/select-directory", async (_req, res) => {
  try {
    const selectedPath = await openDirectoryPicker();
    res.json({ path: selectedPath });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
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

app.get("/api/settings/openai", async (_req, res) => {
  try {
    const [apiKey, metadata] = await Promise.all([readOpenAiKey(), readOpenAiMetadata()]);
    res.json(formatOpenAiStatus(apiKey, metadata));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/settings/openai", async (req, res) => {
  const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
  try {
    await writeOpenAiKey(apiKey || null);
    if (apiKey) {
      await writeOpenAiMetadata({ method: "apiKey", updatedAt: Date.now() });
    } else {
      await writeOpenAiMetadata(null);
    }
    const [storedKey, metadata] = await Promise.all([readOpenAiKey(), readOpenAiMetadata()]);
    res.json(formatOpenAiStatus(storedKey, metadata));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete("/api/settings/openai", async (_req, res) => {
  try {
    await writeOpenAiKey(null);
    await writeOpenAiMetadata(null);
    res.json(formatOpenAiStatus(null, null));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/settings/openai/login", async (req, res) => {
  const profile = typeof req.body?.profile === "string" && req.body.profile.trim() ? req.body.profile.trim() : "default";
  try {
    const apiKey = await loginWithOpenAiCli(profile);
    await writeOpenAiKey(apiKey);
    await writeOpenAiMetadata({ method: "cli", profile, updatedAt: Date.now() });
    const [storedKey, metadata] = await Promise.all([readOpenAiKey(), readOpenAiMetadata()]);
    res.json(formatOpenAiStatus(storedKey, metadata));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
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

let activeServer: Server | null = null;

interface StartServerOptions {
  port?: number;
  envPath?: string;
  metadataPath?: string;
}

interface CodexServerHandle {
  port: number;
  close(): Promise<void>;
}

export async function startCodexServer(options: StartServerOptions = {}): Promise<CodexServerHandle> {
  const targetPort = options.port ?? DEFAULT_PORT;
  if (options.envPath) {
    currentEnvPath = path.resolve(options.envPath);
    if (!options.metadataPath) {
      currentMetadataPath = path.join(path.dirname(currentEnvPath), "openai-status.json");
    }
  }
  if (options.metadataPath) {
    currentMetadataPath = path.resolve(options.metadataPath);
  }
  if (activeServer) {
    throw new Error("Codex-Server läuft bereits");
  }

  await new Promise<void>((resolve, reject) => {
    activeServer = httpServer.listen(targetPort, () => {
      console.log(`Codex backend listening on http://localhost:${targetPort}`);
      resolve();
    });
    activeServer.on("error", (error) => {
      activeServer?.close();
      activeServer = null;
      reject(error);
    });
  });

  return {
    port: targetPort,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        if (!activeServer) {
          resolveClose();
          return;
        }
        activeServer.close((error) => {
          if (error) {
            rejectClose(error);
            return;
          }
          activeServer = null;
          resolveClose();
        });
      })
  };
}

const executedScript = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (executedScript === import.meta.url) {
  startCodexServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
