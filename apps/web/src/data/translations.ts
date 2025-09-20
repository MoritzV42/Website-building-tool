import type { TaskStatus } from "../types";

export type Language = "en" | "de";

interface TutorialSection {
  heading: string;
  bullets: string[];
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
    connect: string;
    reconnect: string;
    connecting: string;
    statusConnected: string;
    statusOffline: string;
    branchChanges: (count: number) => string;
    connectLog: (repository: string) => string;
    connectErrorFallback: string;
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
  tutorial: {
    title: string;
    intro: string;
    sections: TutorialSection[];
    outro: string;
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
      connect: "Connect",
      reconnect: "Reconnect",
      connecting: "Connecting…",
      statusConnected: "Connected",
      statusOffline: "Offline",
      branchChanges: (count) => `${count} ${count === 1 ? "change" : "changes"}`,
      connectLog: (repository) => `Repository connected: ${repository}`,
      connectErrorFallback: "Failed to connect"
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
      title: "Quickstart Tutorial",
      intro: "Follow these steps to create a new Codex-driven project and iterate faster.",
      sections: [
        {
          heading: "1. Create or connect a project",
          bullets: [
            "Use \"Connect\" in the top bar to select an empty folder or existing repository.",
            "Codex mirrors the workspace locally and keeps git status in sync.",
            "If your project has a dev server, start it and provide the preview URL in the settings panel."
          ]
        },
        {
          heading: "2. Describe your idea in the task chat",
          bullets: [
            "Activate the element picker, click the component you want to change, and the selector is filled in automatically.",
            "Explain what you need in natural language – layout tweaks, new sections, or data wiring all work.",
            "Submit the task to Codex and it will begin drafting code immediately."
          ]
        },
        {
          heading: "3. Watch Codex build the experience",
          bullets: [
            "The live preview streams every file Codex touches – from new style sheets to component edits.",
            "Each change is rendered instantly so you can see the UX evolve without leaving the page.",
            "If Codex adds assets or scripts, they appear in the preview and in the change feed in real time."
          ]
        },
        {
          heading: "4. Review diffs and iterate",
          bullets: [
            "Inspect patches in the change feed and approve or reject them directly in your editor.",
            "Queue follow-up tasks to refine copy, polish styles, or wire up functionality.",
            "Once satisfied, commit the changes and push them with your usual git workflow."
          ]
        }
      ],
      outro: "Tip: Keep tasks focused. Smaller goals stream faster and make the live preview easier to follow."
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
      connect: "Verbinden",
      reconnect: "Neu verbinden",
      connecting: "Verbinde…",
      statusConnected: "Verbunden",
      statusOffline: "Offline",
      branchChanges: (count) => `${count} ${count === 1 ? "Änderung" : "Änderungen"}`,
      connectLog: (repository) => `Repository verbunden: ${repository}`,
      connectErrorFallback: "Verbindung fehlgeschlagen"
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
      title: "Schnellstart-Tutorial",
      intro: "Mit diesen Schritten erstellst du ein neues Codex-Projekt und arbeitest iterativ.",
      sections: [
        {
          heading: "1. Projekt anlegen oder verbinden",
          bullets: [
            "Klicke oben auf \"Verbinden\" und wähle einen leeren Ordner oder ein bestehendes Repository aus.",
            "Codex spiegelt den Workspace lokal und hält den Git-Status synchron.",
            "Falls dein Projekt einen Dev-Server hat, starte ihn und hinterlege die Preview-URL in den Einstellungen."
          ]
        },
        {
          heading: "2. Idee im Task-Chat beschreiben",
          bullets: [
            "Aktiviere den Element-Picker, klicke das gewünschte Element – der Selektor wird automatisch übernommen.",
            "Formuliere dein Ziel in natürlicher Sprache: Layout, neue Sektionen oder Logik – alles möglich.",
            "Sende den Task an Codex, damit sofort der erste Code-Entwurf entsteht."
          ]
        },
        {
          heading: "3. Live beim Bauen zuschauen",
          bullets: [
            "Die Live-Vorschau zeigt jede Datei, die Codex anfasst – von neuen Stylesheets bis zu Component-Updates.",
            "Alle Änderungen rendern sofort, sodass du das UX ohne Kontextwechsel beurteilen kannst.",
            "Legt Codex Styles oder Skripte an, siehst du sie direkt in der Vorschau und im Change Feed."
          ]
        },
        {
          heading: "4. Diffs prüfen und weiter iterieren",
          bullets: [
            "Checke Patches im Change Feed und entscheide dort über Annehmen oder Verwerfen.",
            "Reihe Folge-Tasks ein, um Texte zu verfeinern, Styles zu polieren oder Funktionen anzubinden.",
            "Bist du zufrieden, committe wie gewohnt und pushe deine Änderungen."
          ]
        }
      ],
      outro: "Tipp: Halte Tasks fokussiert. Kleine Ziele streamen schneller und machen die Live-Vorschau übersichtlicher."
    }
  }
};
