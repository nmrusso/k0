import { usePanelStore } from "@/stores/panelStore";
import { useClusterStore } from "@/stores/clusterStore";
import { stopLogStream } from "@/lib/tauri-commands";
import { ScrollText, Terminal, X, Plus } from "lucide-react";

export function PanelTabBar() {
  const tabs = usePanelStore((s) => s.tabs);
  const activeTabId = usePanelStore((s) => s.activeTabId);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);
  const closeTab = usePanelStore((s) => s.closeTab);
  const openTerminalTab = usePanelStore((s) => s.openTerminalTab);
  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);

  const handleClose = (e: React.MouseEvent, tabId: string, tabType: string) => {
    e.stopPropagation();
    if (tabType === "logs") {
      stopLogStream(tabId).catch(() => {});
    }
    // Shell/terminal PTY cleanup is handled by component unmount (useEffect cleanup)
    closeTab(tabId);
  };

  return (
    <div className="flex items-center border-b border-border bg-muted/30">
      <div className="flex min-w-0 flex-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex shrink-0 items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs transition-colors ${
              tab.id === activeTabId
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            {tab.type === "logs" ? (
              <ScrollText className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Terminal className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="max-w-[120px] truncate">{tab.title}</span>
            <button
              onClick={(e) => handleClose(e, tab.id, tab.type)}
              className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </button>
        ))}
      </div>
      <button
        onClick={() => openTerminalTab({ context: activeContext ?? undefined, namespace: activeNamespace ?? undefined })}
        className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mx-1"
        title="New terminal"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
