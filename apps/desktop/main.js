const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const WEB_DEV_URL = "http://localhost:5173";
const isDev = process.env.NODE_ENV !== "production";

let serverHandle = null;

async function startEmbeddedServer() {
  if (process.env.CODEX_SKIP_EMBED === "1") {
    return;
  }

  const userData = app.getPath("userData");
  const serverRoot = path.join(__dirname, "dist", "server");
  process.env.CODEX_ENV_PATH = path.join(userData, "openai.env");
  process.env.CODEX_OPENAI_METADATA = path.join(userData, "openai-status.json");
  process.env.CODEX_SHADOW_PATH = path.join(userData, "shadow-workspace");
  process.env.CODEX_SERVER_CWD = serverRoot;

  const serverEntry = pathToFileURL(path.join(serverRoot, "index.js")).href;
  try {
    const { startCodexServer } = await import(serverEntry);
    serverHandle = await startCodexServer();
  } catch (error) {
    console.error("Failed to start embedded server", error);
    throw error;
  }
}

async function stopEmbeddedServer() {
  if (!serverHandle) {
    return;
  }
  try {
    await serverHandle.close();
  } catch (error) {
    console.warn("Failed to shut down embedded server", error);
  } finally {
    serverHandle = null;
  }
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 720,
    title: "Codex Website Builder",
    backgroundColor: "#0f172a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.removeMenu();

  if (isDev) {
    window.loadURL(WEB_DEV_URL).catch((error) => {
      console.error("Failed to load dev server", error);
    });
  } else {
    const indexFile = path.join(__dirname, "dist", "renderer", "index.html");
    window.loadFile(indexFile).catch((error) => {
      console.error("Failed to load renderer", error);
    });
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.on("ready", async () => {
  try {
    await startEmbeddedServer();
  } catch (error) {
    console.error(error);
  }
  createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    void stopEmbeddedServer().finally(() => app.quit());
  }
});

app.on("before-quit", () => {
  void stopEmbeddedServer();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
