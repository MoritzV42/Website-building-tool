import type { TaskStatus } from "../types";

export type Language = "en" | "de";

interface TutorialSection {
  heading: string;
  bullets: string[];
}

type TutorialStepPlacement = "top" | "bottom" | "left" | "right";

interface TutorialOverlayStep {
  id: string;
  anchor: string;
  heading: string;
  description: string;
  placement: TutorialStepPlacement;
}

interface TutorialCopy {
  card: {
    title: string;
    intro: string;
    start: string;
    skip: string;
    sections: TutorialSection[];
    outro: string;
  };
  overlay: {
    skip: string;
    back: string;
    next: string;
    finish: string;
    progress: (current: number, total: number) => string;
    steps: TutorialOverlayStep[];
  };
}

interface Translation {
  languageToggle: {
    label: string;
    options: Record<Language, string>;
  };
  topBar: {
    title: string;
    subtitle: (serverUrl: string) => string;
    repositoryLabel: string;
    repositoryPlaceholder: string;
    repositoryHint: string;
    connect: string;
    reconnect: string;
    connecting: string;
    pickDirectory: string;
    pickingDirectory: string;
    statusConnected: string;
    statusOffline: string;
    branchChanges: (count: number) => string;
    connectLog: (repository: string) => string;
    connectErrorFallback: string;
    pickerError: string;
  };
  taskComposer: {
    title: string;
    description: string;
    selectorLabel: string;
    selectorPlaceholder: string;
    clear: string;
    goalLabel: string;
    goalPlaceholder: string;
    submit: string;
    submitting: string;
    queueTitle: string;
    emptyState: string;
    statusLabel: Record<TaskStatus, string>;
    logQueued: (selector: string) => string;
  };
  preview: {
    title: string;
    titleWithSelector: (selector: string) => string;
    description: string;
    pickerActive: string;
    pickerInactive: string;
    refresh: string;
    badgeHover: string;
    badgeSelected: string;
  };
  changeFeed: {
    patchesTab: (count: number) => string;
    eventsTab: (count: number) => string;
    emptyPatches: string;
    emptyLogs: string;
    logLevelLabel: Record<"info" | "warning" | "error", string>;
  };
  tutorial: TutorialCopy;
  openAi: {
    title: string;
    description: string;
    placeholder: string;
    connect: string;
    connecting: string;
    replace: string;
    clear: string;
    cancel: string;
    helper: string;
    docsLabel: string;
    statusConnected: (masked: string) => string;
    statusMissing: string;
    errorEmpty: string;
  };
}

export const translations: Record<Language, Translation> = {
  en: {
    languageToggle: {
      label: "Language",
      options: {
        en: "EN",
        de: "DE"
      }
    },
    topBar: {
      title: "Codex Site-Editor",
      subtitle: (serverUrl) => `Local workspace orchestrator • Backend: ${serverUrl}`,
      repositoryLabel: "Repository Path",
      repositoryPlaceholder: "/path/to/project",
      repositoryHint: "Pick the folder that contains your .git directory.",
      connect: "Connect",
      reconnect: "Reconnect",
      connecting: "Connecting…",
      pickDirectory: "Choose Folder",
      pickingDirectory: "Opening…",
      statusConnected: "Connected",
      statusOffline: "Offline",
      branchChanges: (count) => `${count} ${count === 1 ? "change" : "changes"}`,
      connectLog: (repository) => `Repository connected: ${repository}`,
      connectErrorFallback: "Failed to connect",
      pickerError: "Unable to open the system folder picker"
    },
    taskComposer: {
      title: "Task Composer",
      description: "Describe the atomic change you want Codex to perform.",
      selectorLabel: "Selector",
      selectorPlaceholder: "e.g. header > h1",
      clear: "Clear",
      goalLabel: "Goal",
      goalPlaceholder: "Increase CTA size, set background to #6C5CE7, add hover shadow",
      submit: "Send to Codex",
      submitting: "Dispatching…",
      queueTitle: "Task Queue",
      emptyState: "No tasks yet — use the composer above to get started.",
      statusLabel: {
        pending: "Pending",
        processing: "Processing",
        completed: "Completed",
        failed: "Failed"
      },
      logQueued: (selector) => `Task queued for ${selector}`
    },
    preview: {
      title: "Live Preview",
      titleWithSelector: (selector) => `Live Preview • ${selector}`,
      description: "Hover to inspect the preview. Activate the picker to capture a stable selector.",
      pickerActive: "Picking… click element",
      pickerInactive: "Element Picker",
      refresh: "Refresh Preview",
      badgeHover: "Hover",
      badgeSelected: "Selected"
    },
    changeFeed: {
      patchesTab: (count) => `Patches (${count})`,
      eventsTab: (count) => `Events (${count})`,
      emptyPatches: "No patches yet. Tasks will stream visual diffs here.",
      emptyLogs: "Logs from the backend, git watcher, and task runner appear here.",
      logLevelLabel: {
        info: "Info",
        warning: "Warning",
        error: "Error"
      }
    },
    tutorial: {
      card: {
        title: "Guided onboarding",
        intro: "Take the interactive tour to see how Codex connects to your repository, GPT account, and live preview.",
        start: "Start guided tour",
        skip: "Skip for now",
        sections: [
          {
            heading: "1. Connect your Git workspace",
            bullets: [
              "Use the \"Choose Folder\" button in the top bar to select the root folder that contains your .git directory.",
              "Codex mirrors the repository locally and keeps git status and file watchers in sync.",
              "Keep the backend running while you work so file changes stream instantly into the UI."
            ]
          },
          {
            heading: "2. Describe the next change",
            bullets: [
              "Activate the element picker, click the component you want to adjust, and Codex fills the selector automatically.",
              "Explain your goal in natural language – layout tweaks, new features, copy updates or refactors all work.",
              "Send the task to Codex and watch it create patches in your shadow workspace."
            ]
          },
          {
            heading: "3. Review preview & diffs",
            bullets: [
              "The live preview streams each patch so you can validate UX changes immediately.",
              "Use the change feed to inspect diff snippets, logs, and file events without leaving the browser.",
              "Commit approved patches in your editor once you're happy with the outcome."
            ]
          },
          {
            heading: "4. Link your GPT account",
            bullets: [
              "Add your GPT API key in the \"Connect Codex to GPT\" card to let Codex draft tasks with your own account.",
              "Keys are stored locally in your .env file and never leave your machine.",
              "You can remove or rotate the key at any time from the same panel."
            ]
          }
        ],
        outro: "Tip: You can restart the guided tour at any time via the card above the task composer."
      },
      overlay: {
        skip: "Skip tutorial",
        back: "Back",
        next: "Next",
        finish: "Finish",
        progress: (current, total) => `Step ${current} of ${total}`,
        steps: [
          {
            id: "connect-repo",
            anchor: "repository",
            heading: "Connect your repository",
            description:
              "Pick the root folder that contains .git, then press Connect. Codex mirrors the repo and streams git status.",
            placement: "bottom"
          },
          {
            id: "task-composer",
            anchor: "task-composer",
            heading: "Describe the change",
            description:
              "Use the element picker to fill the selector automatically, then write the outcome you expect Codex to build.",
            placement: "right"
          },
          {
            id: "preview",
            anchor: "preview",
            heading: "Watch the live preview",
            description: "Patches render instantly here so you can validate UX without leaving the dashboard.",
            placement: "left"
          },
          {
            id: "change-feed",
            anchor: "change-feed",
            heading: "Inspect diffs & logs",
            description: "Every patch and backend log appears here. Approve changes once you're satisfied.",
            placement: "left"
          },
          {
            id: "gpt-connect",
            anchor: "gpt-connect",
            heading: "Link Codex to GPT",
            description:
              "Paste your GPT API key, save it locally, and you're ready to draft tasks with your own account.",
            placement: "right"
          }
        ]
      }
    },
    openAi: {
      title: "Connect Codex to GPT",
      description: "Codex uses your GPT account to generate code. Add your API key once and it stays on your machine.",
      placeholder: "sk-...",
      connect: "Save API key",
      connecting: "Saving…",
      replace: "Replace key",
      clear: "Remove key",
      cancel: "Cancel",
      helper: "Keys are written to .env in this repository. Restart the dev server after rotating credentials.",
      docsLabel: "Open setup guide",
      statusConnected: (masked) => `Connected • ${masked}`,
      statusMissing: "Not connected yet",
      errorEmpty: "Enter your API key before saving."
    }
  },
  de: {
    languageToggle: {
      label: "Sprache",
      options: {
        en: "EN",
        de: "DE"
      }
    },
    topBar: {
      title: "Codex Site-Editor",
      subtitle: (serverUrl) => `Lokaler Workspace-Orchestrator • Backend: ${serverUrl}`,
      repositoryLabel: "Repository-Pfad",
      repositoryPlaceholder: "/pfad/zum/projekt",
      repositoryHint: "Wähle den Ordner, der dein .git-Verzeichnis enthält.",
      connect: "Verbinden",
      reconnect: "Neu verbinden",
      connecting: "Verbinde…",
      pickDirectory: "Pfad auswählen",
      pickingDirectory: "Öffne…",
      statusConnected: "Verbunden",
      statusOffline: "Offline",
      branchChanges: (count) => `${count} ${count === 1 ? "Änderung" : "Änderungen"}`,
      connectLog: (repository) => `Repository verbunden: ${repository}`,
      connectErrorFallback: "Verbindung fehlgeschlagen",
      pickerError: "Ordnerauswahl konnte nicht geöffnet werden"
    },
    taskComposer: {
      title: "Task Composer",
      description: "Beschreibe die atomare Änderung, die Codex umsetzen soll.",
      selectorLabel: "Selektor",
      selectorPlaceholder: "z. B. header > h1",
      clear: "Leeren",
      goalLabel: "Ziel",
      goalPlaceholder: "CTA größer, Hintergrund #6C5CE7, Hover mit Schatten",
      submit: "An Codex senden",
      submitting: "Sende…",
      queueTitle: "Task-Warteschlange",
      emptyState: "Noch keine Tasks – starte oben im Composer.",
      statusLabel: {
        pending: "Wartet",
        processing: "In Arbeit",
        completed: "Fertig",
        failed: "Fehlgeschlagen"
      },
      logQueued: (selector) => `Task eingereiht für ${selector}`
    },
    preview: {
      title: "Live-Vorschau",
      titleWithSelector: (selector) => `Live-Vorschau • ${selector}`,
      description: "Hover zum Inspizieren der Vorschau. Aktivere den Picker, um einen stabilen Selektor zu übernehmen.",
      pickerActive: "Auswahl… Element klicken",
      pickerInactive: "Element-Picker",
      refresh: "Vorschau aktualisieren",
      badgeHover: "Hover",
      badgeSelected: "Ausgewählt"
    },
    changeFeed: {
      patchesTab: (count) => `Patches (${count})`,
      eventsTab: (count) => `Events (${count})`,
      emptyPatches: "Noch keine Patches. Tasks streamen ihre Diffs hier hinein.",
      emptyLogs: "Logs vom Backend, Git-Watcher und Task-Runner erscheinen hier.",
      logLevelLabel: {
        info: "Info",
        warning: "Warnung",
        error: "Fehler"
      }
    },
    tutorial: {
      card: {
        title: "Geführtes Onboarding",
        intro: "Lass dir in wenigen Schritten zeigen, wie Codex Repository, GPT-Account und Live-Vorschau verbindet.",
        start: "Tutorial starten",
        skip: "Überspringen",
        sections: [
          {
            heading: "1. Git-Workspace verbinden",
            bullets: [
              "Nutze den Button \"Pfad auswählen\" in der Kopfzeile und wähle den Ordner mit deinem .git-Verzeichnis.",
              "Codex spiegelt das Repository lokal und hält Git-Status sowie Dateiwatcher synchron.",
              "Lass das Backend im Hintergrund laufen, damit Dateiänderungen sofort ins UI gestreamt werden."
            ]
          },
          {
            heading: "2. Nächste Änderung beschreiben",
            bullets: [
              "Aktiviere den Element-Picker, klicke die Ziel-Komponente und Codex übernimmt den Selektor automatisch.",
              "Beschreibe dein Ziel in natürlicher Sprache – Layout, Features, Copy oder Refactorings funktionieren.",
              "Sende den Task und beobachte, wie Codex Patches im Schatten-Workspace erzeugt."
            ]
          },
          {
            heading: "3. Vorschau & Diffs prüfen",
            bullets: [
              "Die Live-Vorschau rendert jede Änderung sofort, damit du das Ergebnis ohne Kontextwechsel bewerten kannst.",
              "Im Change Feed findest du Diff-Ausschnitte, Logs und Dateievents gebündelt.",
              "Bist du zufrieden, bestätige die Änderungen in deinem Editor und committe wie gewohnt."
            ]
          },
          {
            heading: "4. GPT-Account verknüpfen",
            bullets: [
              "Hinterlege deinen GPT-API-Schlüssel im Panel \"Codex mit GPT verbinden\".",
              "Der Schlüssel bleibt lokal in deiner .env-Datei und verlässt deinen Rechner nicht.",
              "Du kannst den Schlüssel jederzeit austauschen oder entfernen."
            ]
          }
        ],
        outro: "Tipp: Du kannst das Tutorial jederzeit über die Karte oberhalb des Task Composers neu starten."
      },
      overlay: {
        skip: "Tutorial überspringen",
        back: "Zurück",
        next: "Weiter",
        finish: "Fertig",
        progress: (current, total) => `Schritt ${current} von ${total}`,
        steps: [
          {
            id: "connect-repo",
            anchor: "repository",
            heading: "Repository verbinden",
            description:
              "Wähle den Git-Root deines Projekts und klicke auf Verbinden. Codex spiegelt den Ordner und liest den Git-Status.",
            placement: "bottom"
          },
          {
            id: "task-composer",
            anchor: "task-composer",
            heading: "Änderung formulieren",
            description:
              "Picker aktivieren, Element wählen und dein Ziel beschreiben – Codex erstellt daraus den Task.",
            placement: "right"
          },
          {
            id: "preview",
            anchor: "preview",
            heading: "Live-Vorschau verfolgen",
            description: "Hier siehst du jede Änderung sofort, inklusive Hover- und Selektor-Overlay.",
            placement: "left"
          },
          {
            id: "change-feed",
            anchor: "change-feed",
            heading: "Diffs & Logs prüfen",
            description: "Alle Patches und Backend-Logs landen hier – perfekt zum Kontrollieren und Freigeben.",
            placement: "left"
          },
          {
            id: "gpt-connect",
            anchor: "gpt-connect",
            heading: "GPT verbinden",
            description: "Trage deinen GPT-Schlüssel ein, speichere ihn lokal und nutze Codex mit deinem Account.",
            placement: "right"
          }
        ]
      }
    },
    openAi: {
      title: "Codex mit GPT verbinden",
      description: "Codex nutzt deinen GPT-Account für Code-Vorschläge. Der Schlüssel bleibt lokal auf deinem Rechner.",
      placeholder: "sk-...",
      connect: "API-Schlüssel speichern",
      connecting: "Speichere…",
      replace: "Schlüssel ersetzen",
      clear: "Schlüssel entfernen",
      cancel: "Abbrechen",
      helper: "Der Schlüssel wird in der .env dieses Repositories abgelegt. Nach Änderungen den Dev-Server neu starten.",
      docsLabel: "Anleitung öffnen",
      statusConnected: (masked) => `Verbunden • ${masked}`,
      statusMissing: "Noch nicht verbunden",
      errorEmpty: "Bitte gib vor dem Speichern einen API-Schlüssel ein."
    }
  }
};
