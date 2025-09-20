# Codex Site-Editor

**Lokale No-Confirm-Web-Editing-Plattform mit Live-Diff, Element-Auswahl und GitHub-Workflow**

> TL;DR: Starte eine lokale Web-Oberfläche, verbinde einen Projektordner, klicke Elemente auf der Seite an, schreibe Änderungswünsche an „Codex“, beobachte live die Diffs auf der Seite, bestätige oder verwerfe Änderungen, commit & push – inkl. Auto‑PR.

---

## Features

* 🔴 **Live-Preview**: Rendert deine Website (dev‑server oder statisch) in einem iframe.
* 🖱️ **Element‑Picker**: Overlay zum Anklicken von DOM‑Elementen → generiert stabile CSS‑Selectoren/XPath.
* 🤖 **Codex‑Aufträge**: Schreibe natürlichsprachliche Aufgaben (z. B. „CTA größer, #6C5CE7, Hover mit Schatten“).
* ✨ **Live‑Änderungen ohne Dauer‑Bestätigung**: Codex führt kleine, atomare Änderungen direkt aus und zeigt sie im Overlay mit Kommentaren.
* ✅ **On‑Page‑Bestätigung**: Akzeptiere/Verwirf jede Änderung inline; Batch‑Approve möglich.
* 🧩 **Diff‑Overlay**: Code‑Diff (unified/side‑by‑side) + visuelle Markierung im Preview.
* 🔧 **Datei‑Operationen**: Editieren, anlegen, verschieben, refactoren – sicher via Schatten‑Workspace.
* 🧪 **Playground‑Checks**: Lint/Typecheck/Tests vor dem Commit (optional, schnell).
* 🌱 **Git‑Flow**: Feature‑Branch, Commits mit AI‑Message, Push, Auto‑PR via GitHub API.
* 🔒 **Local‑first**: Läuft offline; externe LLM‑Calls optional über CLI‑Adapter.

---

## Architektur

```text
UI (React + Tailwind + shadcn/ui)
  ├─ PreviewFrame (iframe)  ← dev-server (Vite/Next/Static)
  ├─ ElementPicker Overlay  ↔ Selector Engine (DOM to selector)
  ├─ Changes Panel (diffs, comments, approve/reject)
  └─ Task Composer (prompt, context, history)

Local Backend (Node/Express + WS)
  ├─ Repo Manager (fs + chokidar)
  ├─ Git Adapter (simple-git/CLI)
  ├─ LLM/Codex Runner (stdio/JSON-RPC over WS)
  ├─ Patch Sandbox (shadow workspace + 3‑way merge)
  ├─ Build Hooks (lint/typecheck/test/preview reload)
  └─ GitHub Adapter (REST/GraphQL; PRs, statuses)
```

---

## Tech‑Stack

* **Frontend**: React, Vite, Tailwind, shadcn/ui, Zustand, Monaco Editor, diff2html, DOM‑Highlighter.
* **Backend**: Node.js (Express/Fastify), WebSocket, chokidar, simple‑git, isomorphic‑git (Fallback), unified‑diff.
* **LLM‑Adapter**: generisch via STDIN/STDOUT (JSON‑RPC), konfigurierbar (lokal/remote).
* **Auth (GitHub)**: Personal Access Token (classic/fine‑grained) via .env; lokale Nutzung auch ohne GitHub möglich.

---

## Quickstart

```bash
# 1) Repo klonen
git clone https://github.com/<you>/codex-site-editor.git
cd codex-site-editor

# 2) Setup
npm install   # installiert Root + Workspaces
cp .env.example .env   # GITHUB_TOKEN optional

# 3) Dev-Server
npm run dev
# UI: http://localhost:5173  (Backend auf 8787)
```

**Projektordner verbinden:** In der UI → **Connect Repository** → Pfad wählen.

* Wenn dein Projekt einen Dev‑Server hat (z. B. Vite/Next): URL eintragen (z. B. [http://localhost:3000](http://localhost:3000)).
* Für statische Sites: Build‑Ordner (z. B. `dist/`) angeben.

---

## Workflow

1. **Element auswählen**: Picker aktivieren → Element anklicken → Selector erscheint.
2. **Aufgabe formulieren**: „Erhöhe die Schriftgröße des H1 um 6 px, Farbe #6C5CE7, mobile < 400 px kleiner.“
3. **Kontext einspeisen**: UI übergibt Dateien, Selector, Snippets, Projektregeln (Prettier, ESLint, Tailwind config) an Codex.
4. **Codex‑Änderung**: Runner erzeugt Patch(es) im Schatten‑Workspace, baut Projekt und streamt Diffs + Kommentare ins UI.
5. **Bestätigen/Verwerfen**: Inline auf der Seite oder im Diff‑Panel.
6. **Commit/Push**: Feature‑Branch, konventionelle Commit‑Message, optional Auto‑PR.

---

## Sicherheits‑/Qualitätsleitplanken

* Atomare Changes (kleine Patches, klare Kommentare).
* Respektiert Formatter/ESLint/TS – „fix“ vor Commit.
* Kein Überschreiben großer Dateien ohne 3‑way merge.
* CI‑leichte Checks (typecheck, quick tests) vor Push.
* Rollback‑Button je Patch/Batch.

---

## Konfiguration

`/.codexrc.json`

```json
{
  "projectStyle": {
    "framework": "vite-react",
    "css": "tailwind",
    "components": "shadcn"
  },
  "preview": {
    "mode": "dev-server",
    "url": "http://localhost:3000"
  },
  "applyPolicy": {
    "autoApply": true,
    "maxPatchLines": 80,
    "requireApprovalFor": ["schema", "routes", "package.json"]
  },
  "git": {
    "branchPrefix": "codex/",
    "conventionalCommits": true
  }
}
```

`.env.example`

```
GITHUB_TOKEN=
GITHUB_REPO=owner/name
GITHUB_DEFAULT_BASE=main
```

---

## JSON‑RPC zwischen UI ↔ Backend ↔ Codex

**UI → Backend**

```json
{
  "method": "codex.applyTask",
  "params": {
    "selector": "header > h1",
    "goal": "Farbe #6C5CE7, +6px, mobile kleiner",
    "context": {
      "files": ["src/App.tsx", "src/styles.css"],
      "projectRules": {"prettier": true, "eslint": true}
    }
  },
  "id": 42
}
```

**Backend → UI (Streaming Events)**

```json
{"event":"patch","file":"src/App.tsx","diff":"@@ ..."}
{"event":"preview-mark","selector":"header > h1","note":"Font-size +6px"}
{"event":"check","type":"typecheck","status":"pass"}
{"event":"await-approval","batchId":"b123","count":3}
```

---

## GitHub‑Flow (optional)

* Branch: `codex/<slug>`
* Commit: konventionell (`feat(ui): enlarge hero heading`) – Body enthält AI‑Diff‑Summary.
* Push → Auto‑PR mit Check‑Status (leichtgewichtig) und verlinkten Patches.

---

## Roadmap

* [ ] Multi‑Selector‑Tasks (mehrere Elemente gleichzeitig)
* [ ] Design‑Token‑Assistent (Farben/Typo konsistent)
* [ ] Screenshot‑Diffs (VisReg)
* [ ] Undo/Redo History im UI
* [ ] Prompt‑Kataloge („Komponente refactoren“, „Barrierefreiheit prüfen“)
* [ ] VS Code‑Extension (UI im Panel)

---

## Entwicklung

**Monorepo Struktur**

```
/apps
  /server   (Express + WS Backend für JSON-RPC, Repo- und Git-Adapter)
  /web      (Vite + React UI inkl. Element-Picker & Diff-Panel)
/package.json (Workspaces & gemeinsame Scripts)
/.codexrc.json (Apply-Policy & Preview-Defaults)
```

**NPM Scripts (Root)**

| Command | Beschreibung |
| --- | --- |
| `npm run dev` | startet UI (`apps/web`) & Backend (`apps/server`) parallel |
| `npm run dev:web` | nur die Vite UI (Port 5173) |
| `npm run dev:server` | nur den Node/WS Backend-Server (Port 8787) |
| `npm run build` | UI bundlen + Server transpilieren |
| `npm run lint` | ESLint über Workspaces |

---

## Lizenz

MIT – nutze gerne, PRs willkommen.

---

# 📜 Prompt für „Codex“ (Builder‑Agent)

> Diesen Prompt im Terminal‑Runner nutzen. Der Runner kommuniziert via JSON‑RPC über STDIN/STDOUT. Die UI sendet Aufgaben/Selektoren/Kontext; du antwortest mit geplanten Aktionen, Patches, Kommentaren und Checks.

**Rolle**: Senior Full‑Stack‑Engineer & Refactoring‑Assistent für Web‑UIs.

**Ziele**

1. Kleine, reversible Änderungen, die die vom Nutzer gewählten Elemente exakt adressieren.
2. Visuell sofort sichtbare Resultate im Preview; Code bleibt idiomatisch und formatiert.
3. Nach jedem Patch: kurze Begründung + Test-/Check‑Plan.

**Werkzeuge (JSON‑RPC Methoden – benutze sie in deiner Ausgabe)**

* `fs.read(path)` → Inhalt
* `fs.write(path, content)` → schreibt Datei
* `fs.patch(path, unifiedDiff)` → bevorzugt; 3‑way merge wird serverseitig ausgeführt
* `git.status()` / `git.commit(message)` / `git.branch(name)`
* `project.run("lint|format|typecheck|test")`
* `preview.mark(selector, note)` → visuelle Annotation
* `await.approval(batchId)` → fordere UI‑Bestätigung für sensible Änderungen an

**Eingabekontext (vom Server geliefert)**

* `selector`, `goal` (Nutzerwunsch), relevante `files`, `projectRules` (Prettier/ESLint/Tailwind), ggf. `designTokens`.

**Ausgabeformat (immer JSON‑Zeilen, eine Aktion pro Zeile)**

```json
{"plan":"Increase H1 size by 6px via Tailwind class"}
{"fs.patch":{"path":"src/App.tsx","diff":"@@ ..."}}
{"preview.mark":{"selector":"header > h1","note":"+6px, #6C5CE7"}}
{"project.run":"format"}
{"project.run":"typecheck"}
{"git.commit":"feat(ui): enlarge hero heading"}
```

**Leitplanken**

* Bevorzuge **Tailwind/Utility**‑Anpassungen, ansonsten lokale CSS‑Module, erst zuletzt globale Styles.
* Keine Breaking Changes (Props/Contracts) ohne `await.approval`.
* Respektiere `.codexrc.json` – insbesondere `applyPolicy.maxPatchLines`.
* Halte Patches **atomar** (ein Intent = ein Patch + Commit).
* Schreibe **Commit‑Bodies** automatisch mit einer kurzen Diff‑Zusammenfassung (max. 5 Zeilen).

**Qualitätschecks vor Commit**

1. `project.run("format")`
2. `project.run("lint")`
3. `project.run("typecheck")`
4. Optional: Schnelltests, falls vorhanden

**Beispiel‑Task**

> selector: `header > h1`, goal: „Farbe #6C5CE7, +6px, mobile < 400 px kleiner“

**Erwartete Schritte (vereinfacht)**

1. Ermitteln, wo `h1` definiert ist (Komponente/Styles).
2. Diff erzeugen (Tailwind‑Klassen ergänzen oder lokale CSS‑Klasse hinzufügen).
3. `preview.mark` setzen (sichtbare Notiz im Overlay).
4. Checks ausführen; Commit schreiben.

**Fehler‑/Konflikt‑Handling**

* Bei Merge‑Konflikt: kleiner machen, Datei‑Segment gezielt patchen, erneut versuchen.
* Bei Build‑Fehler: Patch revertieren und alternativen Ansatz vorschlagen.
* Bei unklarer Selektierbarkeit: `await.approval` anfordern und Alternativen listen.

**Stil**

* Kurz, präzise, technische Kommentare.
* Keine Floskeln, kein Smalltalk. Nur Aktionen und knappe Begründungen.

---

## Contributing

1. Issue eröffnen (Feature/bug).
2. Branch `codex/<topic>`.
3. PR mit reproduzierbarem Testfall/Screenshots.

---

## FAQ

**F: Kann ich komplett offline arbeiten?**
A: Ja. Der LLM‑Runner kann lokal sein; GitHub‑Features sind optional.

**F: Was, wenn die UI etwas „zu viel“ auto‑applied?**
A: Begrenze `maxPatchLines`, setze `requireApprovalFor` gezielt.

**F: Wie werden Selector stabil gehalten?**
A: Kombination aus CSS‑Pfad, `data-testid` und Heuristiken (Ranking, Fallbacks).
