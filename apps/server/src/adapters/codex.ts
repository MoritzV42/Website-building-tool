import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { promises as fsp } from "node:fs";
import path from "node:path";

export type CodexAdapterMode = "cli" | "api";

export interface CodexRunTaskRequest {
  selector: string;
  goal: string;
  context?: CodexTaskContext;
}

export interface CodexTaskContext {
  files?: string[];
  projectRules?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CodexPatchSummary {
  files: string[];
  totalLines: number;
  additions?: number;
  deletions?: number;
}

export type CodexStreamEvent =
  | { event: "mode"; mode: CodexAdapterMode; message?: string }
  | { event: "plan"; steps: string[] }
  | { event: "diff"; file: string; unified: string }
  | { event: "comment"; selector?: string; note: string }
  | { event: "check"; name: string; status: "pass" | "fail" | "error"; details?: string }
  | { event: "await-approval"; batchId: string; reason: string; summary?: CodexPatchSummary }
  | { event: "retry"; attempt: number; reason: string; next?: string }
  | { event: "apply"; batchId: string; status: "applied" | "skipped" }
  | { event: "complete"; summary: string; status?: "success" | "error" }
  | { event: "error"; message: string; details?: string };

export interface CodexTaskSession {
  id: string;
  source: CodexAdapterMode;
  dispose(): void;
  onClose(handler: () => void): () => void;
  onError(handler: (error: Error) => void): () => void;
}

export interface CodexAdapter {
  readonly mode: CodexAdapterMode;
  readonly statusMessage?: string;
  runTask(request: CodexRunTaskRequest): Promise<CodexTaskSession>;
  streamEvents(taskId: string, listener: (event: CodexStreamEvent) => void): () => void;
  applyPatch(batchId: string): Promise<void>;
  requestApproval(batchId: string, approve: boolean): Promise<void>;
}

interface ApplyPolicyConfig {
  autoApply: boolean;
  maxPatchLines: number;
  requireApprovalFor: string[];
}

interface CodexConfig {
  applyPolicy: ApplyPolicyConfig;
  git: {
    branchPrefix: string;
    conventionalCommits: boolean;
  };
}

const DEFAULT_CONFIG: CodexConfig = {
  applyPolicy: {
    autoApply: true,
    maxPatchLines: 80,
    requireApprovalFor: ["schema", "routes", "package.json", "src/styles/global.css"]
  },
  git: {
    branchPrefix: "codex/",
    conventionalCommits: true
  }
};

interface CodexAdapterManagerOptions {
  workspaceRoot: string;
  configPath?: string;
  codexBinary?: string;
  env?: NodeJS.ProcessEnv;
  logger?: Pick<typeof console, "log" | "warn" | "error">;
}

interface PendingApproval {
  batchId: string;
  summary: CodexPatchSummary;
  reason: string;
  child: ChildProcessWithoutNullStreams;
  session: InternalTaskSession;
}

interface InternalTaskSession extends CodexTaskSession {
  readonly child?: ChildProcessWithoutNullStreams;
  push(event: CodexStreamEvent): void;
  complete(summary: string): void;
  fail(message: string, details?: string): void;
  emitError(error: Error): void;
  onClose(handler: () => void): () => void;
  onError(handler: (error: Error) => void): () => void;
  onStream(handler: (event: CodexStreamEvent) => void): () => void;
  listenerCount(event: string | symbol): number;
}

class BufferedTaskSession extends EventEmitter implements InternalTaskSession {
  public readonly id: string;
  public readonly source: CodexAdapterMode;
  public readonly child?: ChildProcessWithoutNullStreams;
  private ended = false;
  private errorEmitted = false;
  private buffer: CodexStreamEvent[] = [];
  private isStreaming = false;

  constructor(mode: CodexAdapterMode, child?: ChildProcessWithoutNullStreams) {
    super();
    this.id = randomUUID();
    this.source = mode;
    this.child = child;
  }

  dispose() {
    if (this.child && !this.child.killed) {
      try {
        this.child.kill();
      } catch {
        // ignore
      }
    }
    this.close();
  }

  push(event: CodexStreamEvent) {
    if (this.ended) {
      return;
    }
    if (this.isStreaming) {
      this.emit("event", event);
    } else {
      this.buffer.push(event);
    }
  }

  complete(summary: string) {
    if (this.ended) {
      return;
    }
    this.push({ event: "complete", summary, status: "success" });
    this.close();
  }

  fail(message: string, details?: string) {
    if (this.ended) {
      return;
    }
    this.push({ event: "error", message, details });
    this.close();
  }

  emitError(error: Error) {
    if (this.errorEmitted) {
      return;
    }
    this.errorEmitted = true;
    this.emit("error", error);
  }

  onStream(handler: (event: CodexStreamEvent) => void) {
    if (this.ended && this.buffer.length === 0) {
      return () => {
        this.off("event", handler);
      };
    }
    this.isStreaming = true;
    for (const event of this.buffer) {
      handler(event);
    }
    this.buffer = [];
    this.on("event", handler);
    return () => {
      this.off("event", handler);
      if (this.listenerCount("event") === 0) {
        this.isStreaming = false;
      }
    };
  }

  onClose(handler: () => void) {
    this.on("close", handler);
    return () => this.off("close", handler);
  }

  onError(handler: (error: Error) => void) {
    this.on("error", handler);
    return () => this.off("error", handler);
  }

  override emit(event: string | symbol, ...args: unknown[]): boolean {
    if (event === "close") {
      this.ended = true;
    }
    return super.emit(event, ...args);
  }

  private close() {
    if (this.ended) {
      return;
    }
    this.emit("close");
  }
}

class CodexCliAdapter implements CodexAdapter {
  public readonly mode: CodexAdapterMode = "cli";
  public readonly statusMessage?: string;
  private readonly sessions = new Map<string, InternalTaskSession>();
  private readonly approvals = new Map<string, PendingApproval>();
  private readonly retryAttempts = new Map<string, number>();

  constructor(
    private readonly workspaceRoot: string,
    private readonly config: CodexConfig,
    private readonly binary: string,
    private readonly env: NodeJS.ProcessEnv,
    private readonly logger?: Pick<typeof console, "log" | "warn" | "error">
  ) {}

  async runTask(request: CodexRunTaskRequest): Promise<CodexTaskSession> {
    const child = spawn(this.binary, this.buildArgs(request), {
      cwd: this.workspaceRoot,
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    const session = new BufferedTaskSession(this.mode, child);
    this.sessions.set(session.id, session);

    child.on("error", (error) => {
      this.logger?.error?.(`Codex CLI failed: ${(error as Error).message}`);
      this.sessions.delete(session.id);
      session.emitError(error as Error);
      session.fail("Codex CLI konnte nicht gestartet werden.");
    });

    let stderrBuffer = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderrBuffer += chunk;
      if (chunk.trim()) {
        this.logger?.warn?.(`[codex-cli] ${chunk.trim()}`);
      }
    });

    child.stdout.setEncoding("utf8");
    let buffer = "";
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          this.handleCliLine(session, child, line);
        }
        newlineIndex = buffer.indexOf("\n");
      }
    });

    child.on("close", (code) => {
      this.sessions.delete(session.id);
      this.cleanupApprovals(session.id);
      if (code !== 0) {
        const message = stderrBuffer.trim() || `Codex CLI exited with code ${code}`;
        session.fail(message);
        return;
      }
      session.complete("Codex-Task abgeschlossen.");
    });

    session.push({
      event: "mode",
      mode: this.mode,
      message: "Codex CLI-Modus aktiv"
    });

    return session;
  }

  streamEvents(taskId: string, listener: (event: CodexStreamEvent) => void) {
    const sessionState = this.sessions.get(taskId);
    if (!sessionState) {
      throw new Error(`Task ${taskId} ist unbekannt oder bereits beendet.`);
    }
    const unsubscribe = sessionState.onStream(listener);
    return () => {
      unsubscribe();
      if (sessionState.listenerCount("event") === 0) {
        this.sessions.delete(taskId);
      }
    };
  }

  async applyPatch(batchId: string) {
    await this.requestApproval(batchId, true);
  }

  async requestApproval(batchId: string, approve: boolean) {
    const pending = this.approvals.get(batchId);
    if (!pending) {
      throw new Error(`Unbekannter Patch-Batch ${batchId}.`);
    }
    this.sendApproval(pending.child, { approve, batchId });
    const note = approve ? "Patch wurde bestätigt." : "Patch abgelehnt.";
    pending.session.push({ event: "comment", note });
    pending.session.push({ event: "apply", batchId, status: approve ? "applied" : "skipped" });
    this.approvals.delete(batchId);
  }

  private buildArgs(request: CodexRunTaskRequest) {
    const args = ["run", "--json"];
    if (request.selector) {
      args.push("--selector", request.selector);
    }
    if (request.goal) {
      args.push("--goal", request.goal);
    }
    if (request.context?.files?.length) {
      for (const file of request.context.files) {
        args.push("--file", file);
      }
    }
    return args;
  }

  private handleCliLine(session: InternalTaskSession, child: ChildProcessWithoutNullStreams, line: string) {
    let payload: unknown;
    try {
      payload = JSON.parse(line);
    } catch {
      this.logger?.warn?.(`Ungültige CLI-Antwort: ${line}`);
      return;
    }

    const type = typeof payload === "object" && payload !== null ? (payload as { type?: string; event?: string }).type ?? (payload as { type?: string; event?: string }).event : undefined;
    switch (type) {
      case "plan":
        this.handlePlanEvent(session, payload);
        break;
      case "diff":
        this.handleDiffEvent(session, payload);
        break;
      case "comment":
        this.handleCommentEvent(session, payload);
        break;
      case "check":
        this.handleCheckEvent(session, payload);
        break;
      case "awaiting_confirmation":
      case "awaiting-confirmation":
      case "confirmation":
        this.handleConfirmationEvent(session, child, payload);
        break;
      case "complete":
        this.handleCompleteEvent(session, payload);
        break;
      case "error":
        this.handleErrorEvent(session, payload);
        break;
      case "merge_conflict":
      case "merge-conflict":
        this.handleMergeConflict(session, child, payload);
        break;
      default:
        if (type) {
          this.logger?.log?.(`Ignoriere unbekannten Codex-Event-Typ: ${type}`);
        }
        break;
    }
  }

  private handlePlanEvent(session: InternalTaskSession, payload: unknown) {
    const steps = Array.isArray((payload as { steps?: unknown }).steps)
      ? ((payload as { steps?: unknown }).steps as unknown[]).map((step) => String(step))
      : [];
    session.push({ event: "plan", steps });
  }

  private handleDiffEvent(session: InternalTaskSession, payload: unknown) {
    const candidateFile = (payload as { file?: unknown }).file;
    const file: string = typeof candidateFile === "string" ? candidateFile : "unknown";
    const unifiedCandidate = (payload as { unified?: unknown }).unified;
    let unified: string;
    if (typeof unifiedCandidate === "string") {
      unified = unifiedCandidate;
    } else {
      const diffCandidate = (payload as { diff?: unknown }).diff;
      unified = typeof diffCandidate === "string" ? diffCandidate : "";
    }
    session.push({ event: "diff", file, unified });
  }

  private handleCommentEvent(session: InternalTaskSession, payload: unknown) {
    const selectorCandidate = (payload as { selector?: unknown }).selector;
    const selector = typeof selectorCandidate === "string" ? selectorCandidate : undefined;
    const noteCandidate = (payload as { note?: unknown }).note;
    let note: string;
    if (typeof noteCandidate === "string") {
      note = noteCandidate;
    } else {
      const messageCandidate = (payload as { message?: unknown }).message;
      note = typeof messageCandidate === "string" ? messageCandidate : JSON.stringify(payload);
    }
    session.push({ event: "comment", selector, note });
  }

  private handleCheckEvent(session: InternalTaskSession, payload: unknown) {
    const nameCandidate = (payload as { name?: unknown }).name;
    const name = typeof nameCandidate === "string" ? nameCandidate : "check";
    const statusCandidate = (payload as { status?: unknown }).status;
    const rawStatus = typeof statusCandidate === "string" ? statusCandidate : "pass";
    const normalized = rawStatus.toLowerCase();
    const status: "pass" | "fail" | "error" = normalized === "fail" || normalized === "error" ? normalized : "pass";
    const detailsCandidate = (payload as { details?: unknown }).details;
    const details = typeof detailsCandidate === "string" ? detailsCandidate : undefined;
    session.push({ event: "check", name, status, details });
  }

  private handleCompleteEvent(session: InternalTaskSession, payload: unknown) {
    const summaryCandidate = (payload as { summary?: unknown }).summary;
    const summary: string = typeof summaryCandidate === "string" ? summaryCandidate : "Codex-Task abgeschlossen.";
    session.complete(summary);
  }

  private handleErrorEvent(session: InternalTaskSession, payload: unknown) {
    const messageCandidate = (payload as { message?: unknown }).message;
    const message: string = typeof messageCandidate === "string" ? messageCandidate : "Unbekannter Fehler im Codex-Task.";
    const detailsCandidate = (payload as { details?: unknown }).details;
    const details = typeof detailsCandidate === "string" ? detailsCandidate : undefined;
    if (/merge conflict/i.test(message)) {
      this.handleMergeConflict(session, session.child as ChildProcessWithoutNullStreams, payload);
      return;
    }
    session.fail(message, details);
  }

  private handleMergeConflict(session: InternalTaskSession, child: ChildProcessWithoutNullStreams, payload: unknown) {
    const attempt = (this.retryAttempts.get(session.id) ?? 0) + 1;
    this.retryAttempts.set(session.id, attempt);
    if (attempt <= 2) {
      session.push({ event: "retry", attempt, reason: "merge-conflict", next: "partial" });
      this.sendApproval(child, { action: "retry", mode: "partial" });
      return;
    }
    const batchId = this.extractBatchId(payload) ?? `${session.id}:merge-${attempt}`;
    const summary = resolvePatchSummary(payload, this.extractFilesFromPayload(payload));
    const reason = "Merge-Konflikt nach mehreren Versuchen";
    this.approvals.set(batchId, { batchId, child, session, summary, reason });
    session.push({ event: "await-approval", batchId, reason, summary });
  }

  private handleConfirmationEvent(session: InternalTaskSession, child: ChildProcessWithoutNullStreams, payload: unknown) {
    const batchId = this.extractBatchId(payload) ?? randomUUID();
    const files = this.extractFilesFromPayload(payload);
    const summary = resolvePatchSummary(payload, files);

    const decision = this.shouldAutoApply(summary);
    if (decision.autoApprove) {
      session.push({
        event: "comment",
        note: `Auto-Confirm aktiviert (${summary.totalLines} Zeilen)`
      });
      this.sendApproval(child, { approve: true, batchId });
      session.push({ event: "apply", batchId, status: "applied" });
      return;
    }

    const reason = decision.reason ?? "Manuelle Freigabe erforderlich.";
    this.approvals.set(batchId, { batchId, child, session, summary, reason });
    session.push({ event: "await-approval", batchId, reason, summary });
  }

  private sendApproval(child: ChildProcessWithoutNullStreams, payload: Record<string, unknown>) {
    if (!child.stdin || child.stdin.destroyed) {
      return;
    }
    child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  private shouldAutoApply(summary: CodexPatchSummary) {
    const { autoApply, maxPatchLines, requireApprovalFor } = this.config.applyPolicy;
    if (!autoApply) {
      return { autoApprove: false, reason: "Automatisches Anwenden ist deaktiviert." };
    }
    if (summary.totalLines > maxPatchLines) {
      return { autoApprove: false, reason: `Patch überschreitet das Limit von ${maxPatchLines} Zeilen.` };
    }
    const normalized = summary.files.map((file) => file.toLowerCase());
    for (const pattern of requireApprovalFor) {
      const lowerPattern = pattern.toLowerCase();
      const matches = normalized.some((file) => file.includes(lowerPattern));
      if (matches) {
        return { autoApprove: false, reason: `Änderungen an geschützten Dateien (${pattern}) erfordern Freigabe.` };
      }
    }
    return { autoApprove: true };
  }

  private cleanupApprovals(sessionId: string) {
    for (const [batchId, approval] of this.approvals.entries()) {
      if (approval.session.id === sessionId) {
        this.approvals.delete(batchId);
      }
    }
    this.retryAttempts.delete(sessionId);
  }

  private extractBatchId(payload: unknown) {
    if (payload && typeof payload === "object") {
      const candidate = (payload as { batchId?: unknown; batch_id?: unknown; id?: unknown }).batchId
        ?? (payload as { batchId?: unknown; batch_id?: unknown; id?: unknown }).batch_id
        ?? (payload as { batchId?: unknown; batch_id?: unknown; id?: unknown }).id;
      if (typeof candidate === "string") {
        return candidate;
      }
    }
    return undefined;
  }

  private extractFilesFromPayload(payload: unknown) {
    const files = new Set<string>();
    if (payload && typeof payload === "object") {
      const directFile = (payload as { file?: unknown }).file;
      if (typeof directFile === "string") {
        files.add(directFile);
      }
      const patch = (payload as { patch?: unknown }).patch;
      if (patch && typeof patch === "object") {
        const patchFiles = (patch as { files?: unknown }).files;
        if (Array.isArray(patchFiles)) {
          for (const file of patchFiles) {
            if (typeof file === "string") {
              files.add(file);
            }
          }
        }
        const patchFile = (patch as { file?: unknown }).file;
        if (typeof patchFile === "string") {
          files.add(patchFile);
        }
      }
    }
    return Array.from(files);
  }
}

class ApiCodexAdapter implements CodexAdapter {
  public readonly mode: CodexAdapterMode = "api";
  public readonly statusMessage?: string;
  private readonly sessions = new Map<string, InternalTaskSession>();

  constructor(private readonly logger?: Pick<typeof console, "log" | "warn" | "error">) {
    this.statusMessage = "Codex läuft im API-Fallback. Stelle sicher, dass ein API-Key hinterlegt ist.";
  }

  async runTask(request: CodexRunTaskRequest): Promise<CodexTaskSession> {
    const session = new BufferedTaskSession(this.mode);
    this.sessions.set(session.id, session);
    setImmediate(() => {
      this.logger?.warn?.("Codex API-Fallback übernommen – CLI nicht verfügbar.");
      session.push({ event: "mode", mode: this.mode, message: "API-Fallback aktiv" });
      session.push({ event: "comment", note: `API-Fallback: ${request.goal}` });
      session.fail(
        "API-Fallback ist aktuell nur eingeschränkt verfügbar. Bitte verbinde dich über die Codex CLI.",
        "Es wurde kein CLI-Login gefunden."
      );
      this.sessions.delete(session.id);
    });
    return session;
  }

  streamEvents(taskId: string, listener: (event: CodexStreamEvent) => void) {
    const state = this.sessions.get(taskId);
    if (!state) {
      throw new Error(`Task ${taskId} ist nicht aktiv.`);
    }
    const unsubscribe = state.onStream(listener);
    return () => {
      unsubscribe();
      if (state.listenerCount("event") === 0) {
        this.sessions.delete(taskId);
      }
    };
  }

  async applyPatch(_batchId: string) {
    void _batchId;
    throw new Error("API-Fallback unterstützt applyPatch nicht.");
  }

  async requestApproval(_batchId: string, _approve: boolean) {
    void _batchId;
    void _approve;
    throw new Error("API-Fallback unterstützt requestApproval nicht.");
  }
}

class NullCodexAdapter implements CodexAdapter {
  public readonly mode: CodexAdapterMode = "api";
  public readonly statusMessage?: string;
  private readonly sessions = new Map<string, InternalTaskSession>();

  constructor(message: string) {
    this.statusMessage = message;
  }

  async runTask(): Promise<CodexTaskSession> {
    const session = new BufferedTaskSession(this.mode);
    this.sessions.set(session.id, session);
    setImmediate(() => {
      session.push({ event: "mode", mode: this.mode, message: "Codex ist nicht verbunden." });
      session.fail(this.statusMessage ?? "Codex ist nicht verfügbar.");
      this.sessions.delete(session.id);
    });
    return session;
  }

  streamEvents(taskId: string, listener: (event: CodexStreamEvent) => void) {
    const session = this.sessions.get(taskId);
    if (!session) {
      throw new Error("Codex ist nicht initialisiert.");
    }
    const unsubscribe = session.onStream(listener);
    return () => {
      unsubscribe();
      if (session.listenerCount("event") === 0) {
        this.sessions.delete(taskId);
      }
    };
  }

  async applyPatch(): Promise<void> {
    throw new Error("Codex ist nicht initialisiert.");
  }

  async requestApproval(): Promise<void> {
    throw new Error("Codex ist nicht initialisiert.");
  }
}

class CodexAdapterManager implements CodexAdapter {
  public readonly mode: CodexAdapterMode;
  public readonly statusMessage?: string;
  private readonly adapter: CodexAdapter;

  constructor(adapter: CodexAdapter) {
    this.adapter = adapter;
    this.mode = adapter.mode;
    this.statusMessage = adapter.statusMessage;
  }

  runTask(request: CodexRunTaskRequest) {
    return this.adapter.runTask(request);
  }

  streamEvents(taskId: string, listener: (event: CodexStreamEvent) => void) {
    return this.adapter.streamEvents(taskId, listener);
  }

  applyPatch(batchId: string) {
    return this.adapter.applyPatch(batchId);
  }

  requestApproval(batchId: string, approve: boolean) {
    return this.adapter.requestApproval(batchId, approve);
  }
}

export async function createCodexAdapterManager(options: CodexAdapterManagerOptions): Promise<CodexAdapterManager> {
  const env = { ...process.env, ...options.env };
  const binary = options.codexBinary ?? "codex";
  const configPath = options.configPath ?? path.join(options.workspaceRoot, ".codexrc.json");
  const config = await loadCodexConfig(configPath);
  const cliAuthenticated = await isCodexCliAuthenticated(binary, options.workspaceRoot, env, options.logger);

  if (cliAuthenticated) {
    const adapter = new CodexCliAdapter(options.workspaceRoot, config, binary, env, options.logger);
    return new CodexAdapterManager(adapter);
  }

  const apiKey = (env.OPENAI_API_KEY ?? "").trim();
  if (apiKey) {
    options.logger?.warn?.("Codex CLI nicht eingeloggt – weiche auf API-Key aus.");
    const adapter = new ApiCodexAdapter(options.logger);
    return new CodexAdapterManager(adapter);
  }

  const adapter = new NullCodexAdapter(
    "Codex CLI ist nicht angemeldet und kein API-Key ist gesetzt. Bitte führe 'codex auth login' aus oder setze OPENAI_API_KEY."
  );
  return new CodexAdapterManager(adapter);
}

async function loadCodexConfig(configPath: string): Promise<CodexConfig> {
  try {
    const raw = await fsp.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<CodexConfig>;
    return {
      applyPolicy: {
        ...DEFAULT_CONFIG.applyPolicy,
        ...(parsed.applyPolicy ?? {})
      },
      git: {
        ...DEFAULT_CONFIG.git,
        ...(parsed.git ?? {})
      }
    } satisfies CodexConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

async function isCodexCliAuthenticated(
  binary: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  logger?: Pick<typeof console, "log" | "warn" | "error">
) {
  return await new Promise<boolean>((resolve) => {
    const child = spawn(binary, ["auth", "status"], {
      cwd,
      env,
      stdio: "ignore"
    });
    child.on("error", (error) => {
      logger?.warn?.(`Codex CLI nicht gefunden (${(error as Error).message}).`);
      resolve(false);
    });
    child.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

function extractPatchSummary(payload: unknown): CodexPatchSummary | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const patch = (payload as { patch?: unknown }).patch;
  if (patch && typeof patch === "object") {
    const files = new Set<string>();
    const directFile = (patch as { file?: unknown }).file;
    if (typeof directFile === "string") {
      files.add(directFile);
    }
    const patchFiles = (patch as { files?: unknown }).files;
    if (Array.isArray(patchFiles)) {
      for (const file of patchFiles) {
        if (typeof file === "string") {
          files.add(file);
        }
      }
    }
    const totalLines = typeof (patch as { lines?: unknown }).lines === "number"
      ? (patch as { lines?: number }).lines
      : typeof (patch as { totalLines?: unknown }).totalLines === "number"
        ? (patch as { totalLines?: number }).totalLines
        : typeof (patch as { additions?: unknown; deletions?: unknown }).additions === "number" || typeof (patch as { additions?: unknown; deletions?: unknown }).deletions === "number"
          ? Math.abs(((patch as { additions?: number }).additions ?? 0) + ((patch as { deletions?: number }).deletions ?? 0))
          : undefined;
    const diff = typeof (patch as { diff?: unknown }).diff === "string" ? (patch as { diff?: string }).diff : undefined;
    const summary: CodexPatchSummary = {
      files: Array.from(files),
      totalLines: typeof totalLines === "number" && Number.isFinite(totalLines) ? totalLines : diff ? estimateDiffSize(diff) : 0
    };
    if (typeof (patch as { additions?: unknown }).additions === "number") {
      summary.additions = (patch as { additions?: number }).additions;
    }
    if (typeof (patch as { deletions?: unknown }).deletions === "number") {
      summary.deletions = (patch as { deletions?: number }).deletions;
    }
    return summary;
  }

  const diff = typeof (payload as { diff?: unknown }).diff === "string" ? (payload as { diff?: string }).diff : undefined;
  const file = typeof (payload as { file?: unknown }).file === "string" ? (payload as { file?: string }).file : undefined;
  if (diff || file) {
    return {
      files: file ? [file] : [],
      totalLines: diff ? estimateDiffSize(diff) : 0
    };
  }
  return undefined;
}

function resolvePatchSummary(payload: unknown, fallbackFiles: string[]): CodexPatchSummary {
  const summary = extractPatchSummary(payload);
  if (summary) {
    return summary;
  }
  return buildFallbackSummary(payload, fallbackFiles);
}

function buildFallbackSummary(payload: unknown, fallbackFiles: string[]): CodexPatchSummary {
  let totalLines = 0;
  if (payload && typeof payload === "object") {
    const linesValue = (payload as { lines?: unknown }).lines;
    if (typeof linesValue === "number" && Number.isFinite(linesValue)) {
      totalLines = linesValue;
    } else {
      const diffValue = (payload as { diff?: unknown }).diff;
      if (typeof diffValue === "string") {
        totalLines = estimateDiffSize(diffValue);
      }
    }
  }
  return { files: [...fallbackFiles], totalLines };
}

function estimateDiffSize(diff: string) {
  let count = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+") || line.startsWith("-")) {
      count += 1;
    }
  }
  return count;
}

