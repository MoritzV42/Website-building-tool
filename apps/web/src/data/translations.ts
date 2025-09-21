import type { PatchStatus, TaskStatus } from "../types";

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
    statusLabel: Record<PatchStatus, string>;
    actions: {
      apply: string;
      reapply: string;
      reject: string;
      revert: string;
      working: string;
    };
    actionError: string;
  };
  tutorial: TutorialCopy;
  openAi: {
    title: string;
    description: string;
    helper: string;
    docsLabel: string;
    login: string;
    loggingIn: string;
    reconnect: string;
    disconnect: string;
    disconnecting: string;
    loginHint: string;
    loginDetails: string;
    manualLabel: string;
    manualHint: string;
    manualPlaceholder: string;
    manualSave: string;
    manualSaving: string;
    manualDetails: string;
    manualError: string;
    statusConnected: (label: string) => string;
    statusMasked: (masked: string) => string;
    statusManual: (masked: string) => string;
    statusMissing: string;
    cliProfile: (profile: string) => string;
  };
  deployPanel: {
    title: string;
    description: string;
    steps: string[];
    button: string;
    helper: string;
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
      },
      statusLabel: {
        pending: "Pending",
        applied: "Applied",
        discarded: "Discarded",
        reverted: "Reverted"
      },
      actions: {
        apply: "Apply patch",
        reapply: "Apply again",
        reject: "Reject",
        revert: "Revert",
        working: "Working…"
      },
      actionError: "Failed to update patch"
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
              "Use the \"Connect Codex to GPT\" card to run the OpenAI CLI login and link your account.",
              "The generated token stays on your machine inside your Codex profile.",
              "You can disconnect or refresh the login at any time from the same panel."
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
              "Run the OpenAI CLI login from here. Codex keeps the token local so your prompts use your own account.",
            placement: "right"
          }
        ]
      }
    },
    openAi: {
      title: "Connect Codex to GPT",
      description:
        "Sign in once with the OpenAI CLI. Codex stores the token locally and reuses it for your coding sessions.",
      helper: "The login command runs locally; no credentials ever leave your machine.",
      docsLabel: "Open CLI guide",
      login: "Sign in with GPT",
      loggingIn: "Waiting for login…",
      reconnect: "Reconnect GPT account",
      disconnect: "Disconnect",
      disconnecting: "Disconnecting…",
      loginHint: "A browser window opens with the official OpenAI login flow.",
      loginDetails: "After finishing the flow the CLI stores a short-lived API key in ~/.config/openai/config.yaml.",
      manualLabel: "Paste an API key manually",
      manualHint: "Create or reuse an API key on platform.openai.com and paste it here if the CLI login is unavailable.",
      manualPlaceholder: "sk-...",
      manualSave: "Save API key",
      manualSaving: "Saving…",
      manualDetails: "Codex stores the key only inside your local Codex profile directory (never in the cloud).",
      manualError: "Please enter a valid API key before saving.",
      statusConnected: (label: string) => `Connected • ${label}`,
      statusMasked: (masked: string) => `Token ${masked}`,
      statusManual: (masked: string) => `Manual key ${masked}`,
      statusMissing: "Not connected yet",
      cliProfile: (profile: string) => `Linked via OpenAI CLI profile “${profile}”`
    },
    deployPanel: {
      title: "Deploy",
      description: "Share your work by publishing the generated site to Netlify.",
      steps: [
        "Run `npm run build` in your website repository to create the production folder (for example `dist/`).",
        "Create a Netlify site and choose \"Deploy manually\" as the method.",
        "Upload the build folder or run `netlify deploy --dir dist` to generate a shareable preview.",
        "When everything looks right, promote the preview to production inside Netlify."
      ],
      button: "Open Netlify deploy guide",
      helper: "The linked guide walks through connecting the folder and sharing the preview URL."
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
      },
      statusLabel: {
        pending: "Offen",
        applied: "Übernommen",
        discarded: "Verworfen",
        reverted: "Zurückgesetzt"
      },
      actions: {
        apply: "Patch übernehmen",
        reapply: "Erneut übernehmen",
        reject: "Ablehnen",
        revert: "Rückgängig machen",
        working: "Arbeite…"
      },
      actionError: "Patch-Aktion fehlgeschlagen"
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
              "Starte im Panel \"Codex mit GPT verbinden\" den OpenAI-CLI-Login.",
              "Der erzeugte Token bleibt lokal in deinem Codex-Profil.",
              "Du kannst die Verbindung jederzeit neu aufbauen oder trennen."
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
            description: "Starte hier den OpenAI-CLI-Login. Codex nutzt den Token lokal für deine eigenen Prompts.",
            placement: "right"
          }
        ]
      }
    },
    openAi: {
      title: "Codex mit GPT verbinden",
      description: "Melde dich einmal über die OpenAI-CLI an. Codex speichert den Token lokal und nutzt ihn für deine Sessions.",
      helper: "Der Login läuft komplett lokal – der Token bleibt auf deinem Rechner.",
      docsLabel: "CLI-Anleitung öffnen",
      login: "Mit GPT anmelden",
      loggingIn: "Warte auf Anmeldung…",
      reconnect: "Neu verbinden",
      disconnect: "Verbindung trennen",
      disconnecting: "Trenne…",
      loginHint: "Wir öffnen das offizielle OpenAI-Login im Browser.",
      loginDetails: "Nach Abschluss legt die CLI den Schlüssel unter ~/.config/openai/config.yaml ab.",
      manualLabel: "API-Schlüssel direkt eintragen",
      manualHint: "Falls der CLI-Login nicht klappt: Erzeuge auf platform.openai.com einen API-Schlüssel und füge ihn hier ein.",
      manualPlaceholder: "sk-...",
      manualSave: "API-Schlüssel speichern",
      manualSaving: "Speichere…",
      manualDetails: "Codex speichert den Wert ausschließlich lokal in deinem Codex-Profil.",
      manualError: "Bitte gib vor dem Speichern einen gültigen API-Schlüssel ein.",
      statusConnected: (label: string) => `Verbunden • ${label}`,
      statusMasked: (masked: string) => `Token ${masked}`,
      statusManual: (masked: string) => `Eigener Schlüssel ${masked}`,
      statusMissing: "Noch nicht verbunden",
      cliProfile: (profile: string) => `Gekoppelt über CLI-Profil „${profile}“`
    },
    deployPanel: {
      title: "Deploy",
      description: "Veröffentliche deine generierte Site mit wenigen Klicks auf Netlify.",
      steps: [
        "Führe `npm run build` im Projekt aus und erhalte den Ordner `dist/`.",
        "Erstelle auf Netlify eine neue Site und wähle \"Deploy manually\".",
        "Ziehe den Build-Ordner per Drag & Drop hoch oder nutze `netlify deploy --dir dist` für ein Preview.",
        "Wenn alles passt, promote das Preview direkt in Netlify auf Produktion."
      ],
      button: "Netlify-Anleitung öffnen",
      helper: "Die verlinkte Anleitung erklärt Schritt für Schritt das Hochladen und Teilen des Preview-Links."
    }
  }
};
