import { useEffect, useState } from "react";
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
      // Close any open detail sheet
      setSelectedPod(null);
      setSelectedIngress(null);
      setSelectedGateway(null);
      setSelectedResourceName(null);
    },
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
    </div>
  );
}
