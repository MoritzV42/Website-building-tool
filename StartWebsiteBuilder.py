#!/usr/bin/env python3
"""Utility launcher for the Codex Website Builder workspace.

This helper script automates the setup steps described in the README:

* installs npm dependencies (workspace aware)
* ensures a .env file exists based on .env.example
* creates/refreshes a Windows shortcut with the Codex launcher icon
* launches the combined dev server (UI + backend)
* opens the web interface in the default browser

Run it with ``python StartWebsiteBuilder.py`` and stop it via ``Ctrl+C``
when you are done working with the Website Builder.
"""

from __future__ import annotations

import base64
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env"
ENV_TEMPLATE = ROOT / ".env.example"
ICON_PATH = ROOT / "assets" / "codex-launcher.ico"
ICON_SOURCE = ROOT / "assets" / "codex-launcher.ico.b64"


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


def ensure_launcher_icon() -> Path | None:
    """Ensure the launcher icon file exists by decoding the bundled base64 asset."""

    if ICON_PATH.exists():
        return ICON_PATH

    if not ICON_SOURCE.exists():
        print("⚠️  Launcher-Icon konnte nicht gefunden werden – verwende Standard-Icon.")
        return None

    try:
        ICON_PATH.parent.mkdir(parents=True, exist_ok=True)
        encoded = ICON_SOURCE.read_text().encode("ascii")
        ICON_PATH.write_bytes(base64.b64decode(encoded))
        return ICON_PATH
    except (OSError, ValueError) as error:
        print("⚠️  Launcher-Icon konnte nicht erstellt werden:", error)
        return None


def ensure_windows_shortcut(python_path: str) -> None:
    """Create or update a Windows shortcut with the Codex launcher icon."""

    if sys.platform != "win32":
        return

    shortcut_path = (ROOT / "Codex Website Builder.lnk").resolve()
    script_path = (ROOT / "StartWebsiteBuilder.py").resolve()
    icon_file = ensure_launcher_icon()
    icon_path = icon_file.resolve() if icon_file else None

    # PowerShell treats single quotes as literal except doubled quotes, so escape safely.
    def ps_quote(path: Path) -> str:
        return str(path).replace("'", "''")

    command_lines = [
        "$ErrorActionPreference = 'Stop'",
        "$shell = New-Object -ComObject WScript.Shell",
        "$shortcut = $shell.CreateShortcut('{shortcut}')",
        "$shortcut.TargetPath = '{python_exe}'",
        "$shortcut.Arguments = '"{script}"'",
        "$shortcut.WorkingDirectory = '{working_dir}'",
        "$shortcut.WindowStyle = 1",
        "$shortcut.Description = 'Start Codex Website Builder'",
        "$shortcut.Save()",
    ]

    if icon_path is not None:
        command_lines.insert(-2, f"$shortcut.IconLocation = '{ps_quote(icon_path)},0'")

    command = "\n".join(command_lines).format(
        shortcut=ps_quote(shortcut_path),
        python_exe=ps_quote(Path(python_path)),
        script=ps_quote(script_path),
        working_dir=ps_quote(ROOT.resolve()),
    )

    try:
        subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                command,
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        print(f"✅ Windows-Verknüpfung aktualisiert: {shortcut_path.name}")
    except (subprocess.CalledProcessError, FileNotFoundError) as error:
        print("⚠️  Konnte Verknüpfung nicht erstellen:", error)


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

    ensure_windows_shortcut(sys.executable)

    launch_dev_server(npm_path)


if __name__ == "__main__":
    main()
