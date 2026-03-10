import { useEffect, useRef, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { ResourceView } from "@/components/resources/ResourceView";
import { BottomPanel } from "@/components/panel/BottomPanel";
import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { usePanelStore } from "@/stores/panelStore";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useClusterStore } from "@/stores/clusterStore";
import { useTabStore } from "@/stores/tabStore";
import { TabBar } from "./TabBar";
import { CommandPalette } from "@/components/resources/CommandPalette";
import { ShortcutsDialog } from "./ShortcutsDialog";
import type { ResourceType } from "@/types/k8s";

// Chord navigation map: second key → resource type
const G_NAV_MAP: Record<string, ResourceType> = {
  p: "pods",
  d: "deployments",
  s: "services",
  i: "ingresses",
  n: "network-overview",
  c: "configmaps",
  e: "events",
  h: "helm-releases",
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest(".cm-editor")) return true;
  if (target.closest(".xterm")) return true;
  return false;
}

function UpdateBanner({
  version,
  onInstall,
  onDismiss,
}: {
  version: string;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  const [installing, setInstalling] = useState(false);

  return (
    <div className="flex items-center justify-between bg-blue-600 px-4 py-2 text-sm text-white">
      <span>
        Update available <strong>v{version}</strong>
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setInstalling(true);
            onInstall();
          }}
          disabled={installing}
          className="rounded bg-white px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
        >
          {installing ? "Installing..." : "Install & Restart"}
        </button>
        {!installing && (
          <button onClick={onDismiss} className="ml-1 text-white/80 hover:text-white">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

export function MainLayout() {
  const panelIsOpen = usePanelStore((s) => s.isOpen);
  const panelHeight = usePanelStore((s) => s.height);
  const panelTabs = usePanelStore((s) => s.tabs);
  const bottomPadding = panelIsOpen && panelTabs.length > 0 ? panelHeight : 28;

  // Global keyboard shortcuts
  const setSelectedPod = useClusterStore((s) => s.setSelectedPod);
  const setSelectedIngress = useClusterStore((s) => s.setSelectedIngress);
  const setSelectedGateway = useClusterStore((s) => s.setSelectedGateway);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);

  // Tab management
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const openTab = useTabStore((s) => s.openTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const setActiveTab = useTabStore((s) => s.setActiveTab);

  // Panel management
  const togglePanel = usePanelStore((s) => s.togglePanel);
  const openTerminalTab = usePanelStore((s) => s.openTerminalTab);
  const openActivityTab = usePanelStore((s) => s.openActivityTab);

  // Sync active tab → clusterStore.activeResource
  const activeTab = useTabStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab ?? null;
  });
  const setActiveResource = useClusterStore((s) => s.setActiveResource);

  useEffect(() => {
    if (activeTab) {
      setActiveResource(activeTab.resourceType);
    }
  }, [activeTab?.id, activeTab?.resourceType, setActiveResource]);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Chord state for "g + key" navigation
  const pendingChordRef = useRef<string | null>(null);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [chordActive, setChordActive] = useState(false);

  const clearChord = () => {
    pendingChordRef.current = null;
    setChordActive(false);
    clearTimeout(chordTimerRef.current);
  };

  // Chord handler — raw keydown listener alongside useHotkeys
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      const key = e.key.toLowerCase();

      if (pendingChordRef.current === "g") {
        clearChord();
        const dest = G_NAV_MAP[key];
        if (dest) {
          e.preventDefault();
          openTab(dest);
        }
        return;
      }

      if (key === "g") {
        e.preventDefault();
        pendingChordRef.current = "g";
        setChordActive(true);
        chordTimerRef.current = setTimeout(clearChord, 800);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openTab]);

  // Global hotkeys
  useHotkeys({
    "Cmd+k": (e) => {
      e.preventDefault();
      setPaletteOpen(true);
    },
    "Ctrl+k": (e) => {
      e.preventDefault();
      setPaletteOpen(true);
    },
    Escape: () => {
      setSelectedPod(null);
      setSelectedIngress(null);
      setSelectedGateway(null);
      setSelectedResourceName(null);
    },
    "?": () => setShortcutsOpen(true),

    // Refresh
    r: (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent("k0:refresh"));
    },

    // Focus search
    "/": (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent("k0:focus-search"));
    },

    // Tab management
    "Cmd+w": (e) => {
      e.preventDefault();
      if (activeTabId) closeTab(activeTabId);
    },
    "Ctrl+w": (e) => {
      e.preventDefault();
      if (activeTabId) closeTab(activeTabId);
    },
    "Cmd+1": (e) => { e.preventDefault(); tabs[0] && setActiveTab(tabs[0].id); },
    "Cmd+2": (e) => { e.preventDefault(); tabs[1] && setActiveTab(tabs[1].id); },
    "Cmd+3": (e) => { e.preventDefault(); tabs[2] && setActiveTab(tabs[2].id); },
    "Cmd+4": (e) => { e.preventDefault(); tabs[3] && setActiveTab(tabs[3].id); },
    "Cmd+5": (e) => { e.preventDefault(); tabs[4] && setActiveTab(tabs[4].id); },
    "Cmd+6": (e) => { e.preventDefault(); tabs[5] && setActiveTab(tabs[5].id); },
    "Cmd+7": (e) => { e.preventDefault(); tabs[6] && setActiveTab(tabs[6].id); },
    "Cmd+8": (e) => { e.preventDefault(); tabs[7] && setActiveTab(tabs[7].id); },
    "Cmd+9": (e) => { e.preventDefault(); tabs[8] && setActiveTab(tabs[8].id); },
    "Ctrl+1": (e) => { e.preventDefault(); tabs[0] && setActiveTab(tabs[0].id); },
    "Ctrl+2": (e) => { e.preventDefault(); tabs[1] && setActiveTab(tabs[1].id); },
    "Ctrl+3": (e) => { e.preventDefault(); tabs[2] && setActiveTab(tabs[2].id); },
    "Ctrl+4": (e) => { e.preventDefault(); tabs[3] && setActiveTab(tabs[3].id); },
    "Ctrl+5": (e) => { e.preventDefault(); tabs[4] && setActiveTab(tabs[4].id); },
    "Ctrl+6": (e) => { e.preventDefault(); tabs[5] && setActiveTab(tabs[5].id); },
    "Ctrl+7": (e) => { e.preventDefault(); tabs[6] && setActiveTab(tabs[6].id); },
    "Ctrl+8": (e) => { e.preventDefault(); tabs[7] && setActiveTab(tabs[7].id); },
    "Ctrl+9": (e) => { e.preventDefault(); tabs[8] && setActiveTab(tabs[8].id); },

    // Panel shortcuts
    "Cmd+j": (e) => { e.preventDefault(); togglePanel(); },
    "Ctrl+j": (e) => { e.preventDefault(); togglePanel(); },
    "Cmd+t": (e) => { e.preventDefault(); openTerminalTab(); },
    "Ctrl+t": (e) => { e.preventDefault(); openTerminalTab(); },
    "Cmd+Shift+a": (e) => { e.preventDefault(); openActivityTab(); },
    "Ctrl+Shift+a": (e) => { e.preventDefault(); openActivityTab(); },
  });

  const [update, setUpdate] = useState<{
    version: string;
    downloadAndInstall: () => Promise<void>;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    check()
      .then((result) => {
        if (result) {
          setUpdate({
            version: result.version,
            downloadAndInstall: () => result.downloadAndInstall(),
          });
        }
      })
      .catch((err) => {
        console.error("Update check failed:", err);
      });
  }, []);

  const handleInstall = async () => {
    if (!update) return;
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (err) {
      console.error("Update install failed:", err);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {update && !dismissed && (
        <UpdateBanner
          version={update.version}
          onInstall={handleInstall}
          onDismiss={() => setDismissed(true)}
        />
      )}
      <TopBar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <TabBar />
            <main className="flex-1 overflow-auto bg-background p-4" style={{ paddingBottom: bottomPadding + 16 }}>
              <ResourceView />
            </main>
          </div>
        </div>
      </div>
      <BottomPanel />
      <ChatDrawer />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {/* Chord-pending indicator */}
      {chordActive && (
        <div className="pointer-events-none fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-md border border-border bg-popover px-3 py-1.5 font-mono text-sm text-foreground shadow-lg">
          <span className="text-muted-foreground">g</span>
          <span className="ml-2 text-[11px] text-muted-foreground/60">— p d s i n c e h</span>
        </div>
      )}
    </div>
  );
}
