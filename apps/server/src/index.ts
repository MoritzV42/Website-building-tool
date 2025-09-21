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
import { createCodexAdapterManager } from "./adapters/codex.js";
import type { CodexRunTaskRequest, CodexStreamEvent, CodexTaskSession } from "./adapters/codex.js";

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
const NPX_BIN = process.platform === "win32" ? "npx.cmd" : "npx";
const OPENAI_LOGIN_UNSUPPORTED_CODE = "OPENAI_CLI_LOGIN_UNSUPPORTED" as const;

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
  status: PatchStatus;
  resolvedAt: number | null;
  appliedAt: number | null;
}

interface PatchRecord {
  patch: PatchEvent;
  mutatedContent: string;
  revertSnapshot: { existed: boolean; content: string | null } | null;
}

type PatchStatus = "pending" | "applied" | "discarded" | "reverted";

type ServerEvent =
  | { type: "task:created"; task: Task }
  | { type: "task:updated"; task: Task }
  | { type: "patch"; patch: PatchEvent }
  | { type: "patch:updated"; patch: PatchEvent }
  | { type: "patch:bootstrap"; patches: PatchEvent[] }
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

  async readRepositoryFile(relative: string) {
    const source = path.join(this.repoPath, relative);
    try {
      const content = await fsp.readFile(source, "utf8");
      return { content, exists: true };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { content: "", exists: false };
      }
      throw error;
    }
  }

  async writeRepositoryFile(relative: string, content: string) {
    const destination = path.join(this.repoPath, relative);
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await fsp.writeFile(destination, content, "utf8");
  }

  async deleteRepositoryFile(relative: string) {
    const target = path.join(this.repoPath, relative);
    try {
      await fsp.unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

function uniqueValues<T>(values: T[]): T[] {
  const result: T[] = [];
  const seen = new Set<T>();
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function isExecutableFile(target: string) {
  if (!target) {
    return false;
  }
  if (target.includes(".asar") && !target.includes(".asar.unpacked")) {
    return false;
  }
  try {
    const stats = fs.statSync(target);
    if (stats.isFile() || stats.isSymbolicLink()) {
      if (process.platform !== "win32") {
        fs.accessSync(target, fs.constants.X_OK);
      }
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function resolveExecutableFromPath(names: string[]) {
  const normalizedNames = uniqueValues(names.map((name) => name.trim()).filter(Boolean));
  if (!normalizedNames.length) {
    return null;
  }
  const pathValue = process.env.PATH;
  if (!pathValue) {
    return null;
  }
  const directories = uniqueValues(pathValue.split(path.delimiter).filter(Boolean));
  const suffixes =
    process.platform === "win32"
      ? uniqueValues([
          "",
          ...(process.env.PATHEXT?.split(";").filter(Boolean).map((ext) =>
            ext.startsWith(".") ? ext : `.${ext}`
          ) ?? [".COM", ".EXE", ".BAT", ".CMD"])
        ])
      : [""];

  for (const directory of directories) {
    for (const name of normalizedNames) {
      const hasExtension = Boolean(path.extname(name));
      if (hasExtension) {
        const candidate = path.join(directory, name);
        if (isExecutableFile(candidate)) {
          return candidate;
        }
        continue;
      }
      for (const suffix of suffixes) {
        const candidate = path.join(directory, `${name}${suffix}`);
        if (isExecutableFile(candidate)) {
          return candidate;
        }
      }
    }
  }

  return null;
}

function expandAsarAwareCandidates(target: string) {
  const candidates = [target];
  if (target.includes(".asar")) {
    const parts = target.split(path.sep);
    const index = parts.findIndex((segment) => segment.endsWith(".asar"));
    if (index !== -1) {
      const unpackedParts = [...parts];
      unpackedParts[index] = `${parts[index]}.unpacked`;
      candidates.unshift(path.join(...unpackedParts));
    }
  }
  return uniqueValues(candidates);
}

async function runCommand(command: string, args: string[], options: CommandOptions = {}) {
  const env = options.env ?? process.env;
  const commandCandidates = expandAsarAwareCandidates(command);
  const rawCwdCandidates: Array<string | undefined> = [
    ...(options.cwd ? expandAsarAwareCandidates(options.cwd) : []),
    undefined,
    process.cwd(),
    path.dirname(process.execPath),
    os.homedir()
  ];
  const cwdCandidates = uniqueValues(rawCwdCandidates).filter((candidate) => {
    if (candidate === undefined) {
      return true;
    }
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });

  const spawnOnce = (cmd: string, cwd: string | undefined) =>
    new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
      const child = spawn(cmd, args, {
        windowsHide: process.platform === "win32",
        cwd,
        env
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

  let lastSpawnError: NodeJS.ErrnoException | null = null;

  for (const candidateCommand of commandCandidates) {
    for (const candidateCwd of cwdCandidates) {
      try {
        return await spawnOnce(candidateCommand, candidateCwd);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === "EINVAL") {
          lastSpawnError = err;
          continue;
        }
        if (err.code === "ENOENT") {
          lastSpawnError = err;
          break;
        }
        throw error;
      }
    }
  }

  if (lastSpawnError) {
    if (lastSpawnError.code === "EINVAL") {
      const detailedError = new Error(
        "OpenAI-Login konnte nicht gestartet werden. Bitte stelle sicher, dass die OpenAI-CLI installiert ist und Codex auf das Benutzerverzeichnis zugreifen kann."
      );
      (detailedError as NodeJS.ErrnoException).code = lastSpawnError.code;
      throw detailedError;
    }
    throw lastSpawnError;
  }

  throw new Error(`Fehler beim Starten von ${path.basename(command)}.`);
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
  const override = process.env.CODEX_OPENAI_CLI?.trim();
  const overrides = override ? [path.resolve(override)] : [];
  const localCandidates = [
    path.join(SERVER_CWD, "node_modules", ".bin", OPENAI_CLI_BIN),
    path.join(path.resolve(SERVER_CWD, ".."), "node_modules", ".bin", OPENAI_CLI_BIN),
    path.join(path.resolve(SERVER_CWD, "..", ".."), "node_modules", ".bin", OPENAI_CLI_BIN)
  ];

  for (const candidate of uniqueValues([...overrides, ...localCandidates])) {
    for (const resolved of expandAsarAwareCandidates(candidate)) {
      if (isExecutableFile(resolved)) {
        return resolved;
      }
    }
  }

  const fallback = resolveExecutableFromPath(
    uniqueValues([
      OPENAI_CLI_BIN,
      "openai",
      ...(process.platform === "win32" ? ["openai.exe", "openai.cmd", "openai.bat"] : [])
    ])
  );
  if (fallback) {
    return fallback;
  }

  throw new Error(
    "OpenAI CLI wurde nicht gefunden. Installiere das npm-Paket 'openai' (lokal oder im Desktop-Workspace) oder setze CODEX_OPENAI_CLI auf den Pfad."
  );
}

function resolveNpxPath() {
  const override = process.env.CODEX_NPX_PATH?.trim();
  const overrides = override ? [path.resolve(override)] : [];
  const localCandidates = [
    path.join(SERVER_CWD, "node_modules", ".bin", NPX_BIN),
    path.join(path.resolve(SERVER_CWD, ".."), "node_modules", ".bin", NPX_BIN),
    path.join(path.resolve(SERVER_CWD, "..", ".."), "node_modules", ".bin", NPX_BIN)
  ];

  for (const candidate of uniqueValues([...overrides, ...localCandidates])) {
    for (const resolved of expandAsarAwareCandidates(candidate)) {
      if (isExecutableFile(resolved)) {
        return resolved;
      }
    }
  }

  const fallback = resolveExecutableFromPath(uniqueValues([NPX_BIN, "npx"]));
  if (fallback) {
    return fallback;
  }

  throw new Error(
    "npx wurde nicht gefunden. Installiere Node.js 18+ oder setze CODEX_NPX_PATH auf den Pfad zur npx-Binary."
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

interface OpenAiLoginCommandOptions {
  executable: string;
  args: string[];
  label: string;
  spawnErrorHint: string;
}

async function runOpenAiLoginCommand({ executable, args, label, spawnErrorHint }: OpenAiLoginCommandOptions) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: SERVER_CWD,
      env: { ...process.env, OPENAI_CLI_NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: process.platform === "win32",
      shell: process.platform === "win32" && path.extname(executable).toLowerCase() === ".cmd"
    });

    let stdout = "";
    let stderr = "";
    let buffer = "";
    let settled = false;
    const responded = new Set<number>();

    const autoPrompts: RegExp[] = [
      /press\s+(enter|return)\s+to\s+(continue|open|finish)/i,
      /\(y\/n\)/i,
      /\[y\/n\]/i,
      /\(yes\/no\)/i,
      /möchtest du fortfahren\?/i,
      /would you like to continue\?/i
    ];

    const respond = (value = "") => {
      if (!child.stdin || child.stdin.destroyed) {
        return;
      }
      child.stdin.write(`${value}\n`);
    };

    const inspectBuffer = () => {
      for (const [index, pattern] of autoPrompts.entries()) {
        if (responded.has(index)) {
          continue;
        }
        if (pattern.test(buffer)) {
          responded.add(index);
          respond();
        }
      }
      const trailingLine = buffer.split(/\r?\n/).pop();
      if (trailingLine) {
        const trimmed = trailingLine.trim();
        if (
          trimmed.endsWith("?") ||
          /\?\s*(?:\(|\[)?[yn](?:\/[yn])?(?:\)|\])?\s*$/i.test(trimmed)
        ) {
          respond();
        }
      }
    };

    child.stdout?.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      buffer = `${buffer}${text}`.slice(-2000);
      inspectBuffer();
    });

    child.stderr?.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      buffer = `${buffer}${text}`.slice(-2000);
      inspectBuffer();
    });

    let fallbackCount = 0;
    const fallbackInterval = setInterval(() => {
      if (child.exitCode === null && fallbackCount < 8) {
        fallbackCount += 1;
        respond();
      } else if (child.exitCode !== null || fallbackCount >= 8) {
        clearInterval(fallbackInterval);
      }
    }, 1500);

    const initialKick = setTimeout(() => {
      if (child.exitCode === null) {
        respond();
      }
    }, 400);

    const finalize = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearInterval(fallbackInterval);
      clearTimeout(initialKick);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    child.on("error", (error) => {
      const err = error as NodeJS.ErrnoException;
      console.warn(
        `[openai-cli] Login-Aufruf (${label}) konnte nicht gestartet werden (${err.code ?? "unknown"}): ${err.message}`
      );
      if (err.code === "EINVAL" || err.code === "ENOENT") {
        const friendly = new Error(`OpenAI-Login konnte mit ${label} nicht gestartet werden. ${spawnErrorHint}`);
        (friendly as NodeJS.ErrnoException).code = err.code;
        (friendly as { cause?: unknown }).cause = err;
        finalize(friendly);
        return;
      }
      finalize(err);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const combined = `${stderr}${stdout}`.trim();
        if (/unknown\s+subcommand\s+login/i.test(combined) || /invalid\s+choice:\s*'login'/i.test(combined)) {
          const unsupported = new Error(
            "Die verwendete OpenAI-CLI unterstützt den Befehl \"login\" nicht. Folge der offiziellen Installationsanleitung (https://platform.openai.com/docs/guides/openai-cli) oder füge deinen API-Schlüssel manuell in Codex ein."
          );
          (unsupported as NodeJS.ErrnoException).code = OPENAI_LOGIN_UNSUPPORTED_CODE;
          finalize(unsupported);
          return;
        }
        const failure = new Error(combined || `OpenAI-Login mit ${label} fehlgeschlagen.`);
        finalize(failure);
        return;
      }
      finalize();
    });
  });
}

async function loginWithOpenAiCli(profile: string) {
  const args = ["login"];
  if (profile && profile !== "default") {
    args.push("--profile", profile);
  }

  const cliPath = resolveOpenAiCliPath();
  try {
    await runOpenAiLoginCommand({
      executable: cliPath,
      args,
      label: path.basename(cliPath),
      spawnErrorHint:
        "Bitte installiere das npm-Paket 'openai' (lokal oder im Desktop-Workspace) oder setze CODEX_OPENAI_CLI auf den Pfad zur CLI."
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === OPENAI_LOGIN_UNSUPPORTED_CODE) {
      return await loginWithNpxFallback(profile, error as Error);
    }
    throw error;
  }

  const key = await readOpenAiCliKey(profile);
  if (!key) {
    throw new Error(
      "Die Anmeldung wurde abgeschlossen, aber es wurde kein API-Schlüssel gefunden. Bitte versuche es erneut oder lege den Schlüssel manuell fest."
    );
  }
  return key;
}

async function loginWithNpxFallback(profile: string, originalError: Error) {
  let npxPath: string;
  try {
    npxPath = resolveNpxPath();
  } catch (resolveError) {
    const wrapped = new Error(
      `${originalError.message}\n\nAutomatischer Versuch, die aktuelle CLI über npx zu verwenden, konnte nicht gestartet werden: ${(resolveError as Error).message}`
    );
    (wrapped as { cause?: unknown }).cause = resolveError;
    throw wrapped;
  }

  const fallbackArgs = ["-y", "openai@latest", "login"];
  if (profile && profile !== "default") {
    fallbackArgs.push("--profile", profile);
  }

  try {
    await runOpenAiLoginCommand({
      executable: npxPath,
      args: fallbackArgs,
      label: "npx openai@latest",
      spawnErrorHint:
        "Bitte installiere Node.js 18+ (inklusive npx) oder setze CODEX_NPX_PATH auf den Pfad zur npx-Binary."
    });
  } catch (fallbackError) {
    const wrapped = new Error(
      `${originalError.message}\n\nZusätzlicher Versuch mit "npx openai@latest login" schlug fehl: ${(fallbackError as Error).message}`
    );
    (wrapped as { cause?: unknown }).cause = fallbackError;
    throw wrapped;
  }

  const key = await readOpenAiCliKey(profile);
  if (!key) {
    throw new Error(
      `Der Login über "npx openai@latest" wurde abgeschlossen, aber es wurde kein API-Schlüssel gefunden. Bitte führe "npx -y openai@latest login" im Terminal aus oder trage den Schlüssel manuell ein.`
    );
  }
  return key;
}

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
const clients = new Set<WebSocket>();
const workspace = new WorkspaceManager(SERVER_CWD, DEFAULT_SHADOW_PATH);
type ActiveCodexAdapter = Awaited<ReturnType<typeof createCodexAdapterManager>>;
let codexAdapterPromise: Promise<ActiveCodexAdapter> | null = null;

function resetCodexAdapter() {
  codexAdapterPromise = null;
}

async function ensureCodexAdapter(force = false) {
  if (force) {
    resetCodexAdapter();
  }
  if (!codexAdapterPromise) {
    codexAdapterPromise = createCodexAdapterManager({
      workspaceRoot: workspace.getRepositoryPath(),
      configPath: path.join(workspace.getRepositoryPath(), ".codexrc.json"),
      env: process.env,
      logger: console
    });
  }
  return codexAdapterPromise;
}
const tasks: Task[] = [];
const patchRecords = new Map<string, PatchRecord>();

function getPatchesSnapshot() {
  return Array.from(patchRecords.values())
    .map((record) => record.patch)
    .sort((a, b) => b.createdAt - a.createdAt);
}

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
    void ensureCodexAdapter(true).catch((error) => {
      console.warn(`[codex] Adapter konnte nicht neu initialisiert werden: ${(error as Error).message}`);
    });
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

app.post("/api/patches/:id/apply", async (req, res) => {
  try {
    const patch = await applyPatchById(req.params.id);
    res.json(patch);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/patches/:id/reject", async (req, res) => {
  try {
    const patch = await rejectPatchById(req.params.id);
    res.json(patch);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/patches/:id/revert", async (req, res) => {
  try {
    const patch = await revertPatchById(req.params.id);
    res.json(patch);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
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

app.post("/codex/task", async (req, res) => {
  const isRpc = typeof req.body?.method === "string";
  if (isRpc && req.body.method !== "codex.runTask") {
    res.status(400).json({ error: `Unsupported method ${req.body.method}` });
    return;
  }
  const params = isRpc ? req.body.params : req.body;
  if (!params || typeof params.selector !== "string" || typeof params.goal !== "string") {
    res.status(400).json({ error: "selector and goal are required" });
    return;
  }

  let adapter: ActiveCodexAdapter;
  try {
    adapter = await ensureCodexAdapter();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (typeof (res as unknown as { flushHeaders?: () => void }).flushHeaders === "function") {
    (res as unknown as { flushHeaders: () => void }).flushHeaders();
  }

  const request: CodexRunTaskRequest = {
    selector: params.selector,
    goal: params.goal,
    context: typeof params.context === "object" && params.context
      ? (params.context as CodexRunTaskRequest["context"])
      : undefined
  };

  let session: CodexTaskSession;
  try {
    session = await adapter.runTask(request);
  } catch (error) {
    const message = (error as Error).message || "Codex task konnte nicht gestartet werden.";
    res.write(`${JSON.stringify({ event: "error", message })}\n`);
    res.end();
    return;
  }

  const writeEvent = (event: CodexStreamEvent) => {
    res.write(`${JSON.stringify(event)}\n`);
  };

  let unsubscribe: (() => void) | null = null;
  try {
    unsubscribe = adapter.streamEvents(session.id, writeEvent);
  } catch (error) {
    const message = (error as Error).message || "Streaming konnte nicht initialisiert werden.";
    res.write(`${JSON.stringify({ event: "error", message })}\n`);
    res.end();
    session.dispose();
    return;
  }

  let finished = false;
  let closeOff = () => {};
  let errorOff = () => {};
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    closeOff();
    errorOff();
    res.end();
  };

  closeOff = session.onClose(() => {
    finish();
  });
  errorOff = session.onError((error: Error) => {
    writeEvent({ event: "error", message: error.message });
  });

  req.on("close", () => {
    session.dispose();
    finish();
  });
});

app.post("/codex/approve", async (req, res) => {
  const isRpc = typeof req.body?.method === "string";
  if (isRpc && req.body.method !== "codex.approve") {
    res.status(400).json({ error: `Unsupported method ${req.body.method}` });
    return;
  }
  const params = isRpc ? req.body.params : req.body;
  const batchId = typeof params?.batchId === "string" ? params.batchId : undefined;
  if (!batchId) {
    res.status(400).json({ error: "batchId is required" });
    return;
  }
  const approveParam =
    typeof params?.approve === "boolean"
      ? params.approve
      : typeof params?.decision === "string"
        ? params.decision === "approve"
        : undefined;
  const approve = approveParam ?? true;

  try {
    const adapter = await ensureCodexAdapter();
    await adapter.requestApproval(batchId, approve);
    res.json({ batchId, status: approve ? "approved" : "rejected" });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

wss.on("connection", (socket) => {
  clients.add(socket);
  socket.on("close", () => clients.delete(socket));
  socket.send(JSON.stringify({ type: "workspace:ready", repository: workspace.getRepositoryPath() } satisfies ServerEvent));
  socket.send(JSON.stringify({ type: "patch:bootstrap", patches: getPatchesSnapshot() } satisfies ServerEvent));
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

function notifyPatchCreated(patch: PatchEvent) {
  broadcast({ type: "patch", patch });
}

function notifyPatchUpdated(patch: PatchEvent) {
  broadcast({ type: "patch:updated", patch });
}

async function processTask(task: Task) {
  task.status = "processing";
  broadcast({ type: "task:updated", task });

  const file = task.files?.[0] ?? "src/App.tsx";
  const { content: original } = await workspace.readRepositoryFile(file);
  const mutated = synthesizeChange(original, task);
  const diff = createTwoFilesPatch(file, file, original, mutated, "", "");

  await workspace.writeShadowFile(file, mutated);

  const patch: PatchEvent = {
    id: randomUUID(),
    taskId: task.id,
    file,
    diff,
    note: `Applied goal: ${task.goal}`,
    createdAt: Date.now(),
    status: "pending",
    resolvedAt: null,
    appliedAt: null
  };
  patchRecords.set(patch.id, {
    patch,
    mutatedContent: mutated,
    revertSnapshot: null
  });
  notifyPatchCreated(patch);

  task.status = "completed";
  broadcast({ type: "task:updated", task });
}

function requirePatchRecord(patchId: string) {
  const record = patchRecords.get(patchId);
  if (!record) {
    throw new Error(`Patch ${patchId} wurde nicht gefunden.`);
  }
  return record;
}

async function applyPatchById(patchId: string) {
  const record = requirePatchRecord(patchId);
  const snapshot = await workspace.readRepositoryFile(record.patch.file);
  record.revertSnapshot = { existed: snapshot.exists, content: snapshot.exists ? snapshot.content : null };
  await workspace.writeRepositoryFile(record.patch.file, record.mutatedContent);
  const timestamp = Date.now();
  record.patch.status = "applied";
  record.patch.appliedAt = timestamp;
  record.patch.resolvedAt = timestamp;
  notifyPatchUpdated(record.patch);
  return record.patch;
}

async function rejectPatchById(patchId: string) {
  const record = requirePatchRecord(patchId);
  if (record.patch.status === "applied") {
    throw new Error("Patch ist bereits übernommen. Bitte mache ihn zuerst rückgängig.");
  }
  record.revertSnapshot = null;
  const timestamp = Date.now();
  record.patch.status = "discarded";
  record.patch.resolvedAt = timestamp;
  notifyPatchUpdated(record.patch);
  return record.patch;
}

async function revertPatchById(patchId: string) {
  const record = requirePatchRecord(patchId);
  if (record.patch.status !== "applied" || !record.revertSnapshot) {
    throw new Error("Patch wurde noch nicht übernommen oder wurde bereits zurückgesetzt.");
  }
  const { existed, content } = record.revertSnapshot;
  if (existed) {
    await workspace.writeRepositoryFile(record.patch.file, content ?? "");
  } else {
    await workspace.deleteRepositoryFile(record.patch.file);
  }
  record.revertSnapshot = null;
  const timestamp = Date.now();
  record.patch.status = "reverted";
  record.patch.resolvedAt = timestamp;
  notifyPatchUpdated(record.patch);
  return record.patch;
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
