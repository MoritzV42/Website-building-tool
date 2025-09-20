#!/usr/bin/env python3
"""Start the Codex Site-Editor with a single command.

This helper script automates the setup steps described in the README:
* installs npm dependencies (workspace aware)
* ensures a .env file exists based on .env.example
* launches the combined dev server (UI + backend)
* opens the web interface in the default browser

Run it with `python StartWebsiteBuilder.py` and stop it via Ctrl+C when
you are done working with the Website Builder.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env"
ENV_TEMPLATE = ROOT / ".env.example"


def ensure_command_available(executable: str) -> str:
    """Ensure the given executable is available and return its absolute path."""
    path = shutil.which(executable)
    if path is None:
        print(f"❌ {executable} wurde nicht gefunden. Bitte installiere Node.js/npm und starte erneut.")
        sys.exit(1)
    return path


def run_command(cmd: list[str], *, cwd: Path, description: str) -> None:
    """Run a command while streaming its output to the console."""
    print(f"\n➡️  {description}...")
    process = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    assert process.stdout is not None
    try:
        for line in process.stdout:
            print(line, end="")
    except KeyboardInterrupt:
        process.terminate()
        process.wait()
        print("\n⚠️  Vorgang durch Benutzer abgebrochen.")
        sys.exit(1)

    if process.wait() != 0:
        print(f"\n❌ Der Befehl {' '.join(cmd)} ist fehlgeschlagen.")
        sys.exit(1)


def ensure_env_file() -> None:
    """Create .env from .env.example if it is missing."""
    if ENV_FILE.exists():
        return
    if not ENV_TEMPLATE.exists():
        print("⚠️  Keine .env.example gefunden – überspringe Kopiervorgang.")
        return
    shutil.copyfile(ENV_TEMPLATE, ENV_FILE)
    print("✅ .env wurde aus .env.example erstellt. Passe sie bei Bedarf an.")


def launch_dev_server(npm_path: str) -> None:
    """Start the dev server and keep streaming its logs until interruption."""
    print("\n🚀 Starte Entwicklungsserver (Strg+C zum Beenden)...\n")
    process = subprocess.Popen(
        [npm_path, "run", "dev"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    assert process.stdout is not None

    # Gebe dem Server einen Moment zum Starten, bevor der Browser geöffnet wird.
    time.sleep(3)
    webbrowser.open("http://localhost:5173", new=2, autoraise=True)

    try:
        for line in process.stdout:
            print(line, end="")
    except KeyboardInterrupt:
        print("\n🛑 Stoppe Entwicklungsserver...")
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
        print("✅ Entwicklungsserver beendet.")
        return

    if process.wait() != 0:
        print("\n❌ Entwicklungsserver hat einen Fehler gemeldet.")
        sys.exit(1)


def main() -> None:
    print("🔧 Website Builder wird vorbereitet...")

    npm_path = ensure_command_available("npm")

    run_command([npm_path, "install"], cwd=ROOT, description="Installiere Abhängigkeiten")

    ensure_env_file()

    launch_dev_server(npm_path)


if __name__ == "__main__":
    main()
