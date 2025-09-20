const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const desktopRoot = path.resolve(__dirname, "..");
const distRoot = path.join(desktopRoot, "dist");
const serverSource = path.join(ROOT, "apps", "server", "dist");
const rendererSource = path.join(ROOT, "apps", "web", "dist");
const serverTarget = path.join(distRoot, "server");
const rendererTarget = path.join(distRoot, "renderer");

async function copyDirectory(source, target) {
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { recursive: true });
}

async function ensureBuildArtifacts() {
  try {
    await fs.stat(serverSource);
  } catch (error) {
    throw new Error("Server build not found. Run `npm run build --workspace server` first.");
  }

  try {
    await fs.stat(rendererSource);
  } catch (error) {
    throw new Error("Web build not found. Run `npm run build --workspace web` first.");
  }
}

async function main() {
  await ensureBuildArtifacts();
  await fs.mkdir(distRoot, { recursive: true });
  await copyDirectory(serverSource, serverTarget);
  await copyDirectory(rendererSource, rendererTarget);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
