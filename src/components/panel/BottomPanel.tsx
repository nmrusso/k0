import { useCallback, useRef } from "react";
import { usePanelStore } from "@/stores/panelStore";
import { useClusterStore } from "@/stores/clusterStore";
import { PanelTabBar } from "./PanelTabBar";
import { LogViewer } from "./LogViewer";
import { TerminalViewer } from "./TerminalViewer";
import { LocalTerminalViewer } from "./LocalTerminalViewer";
import { Plus } from "lucide-react";

const MIN_HEIGHT = 150;
const MAX_HEIGHT_RATIO = 0.7;

export function BottomPanel() {
  const isOpen = usePanelStore((s) => s.isOpen);
  const height = usePanelStore((s) => s.height);
  const setHeight = usePanelStore((s) => s.setHeight);
  const tabs = usePanelStore((s) => s.tabs);
  const activeTabId = usePanelStore((s) => s.activeTabId);
  const openTerminalTab = usePanelStore((s) => s.openTerminalTab);
  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);

  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startY.current = e.clientY;
      startHeight.current = height;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = startY.current - ev.clientY;
        const maxH = window.innerHeight * MAX_HEIGHT_RATIO;
        const newHeight = Math.min(
          Math.max(startHeight.current + delta, MIN_HEIGHT),
          maxH,
        );
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [height, setHeight],
  );

  // When panel is closed, show the bottom bar with terminal + chat buttons
  if (!isOpen || tabs.length === 0) {
    return (
      <div className="flex items-center border-t border-border bg-muted/30 px-2 py-0.5">
        <button
          onClick={() => openTerminalTab({ context: activeContext ?? undefined, namespace: activeNamespace ?? undefined })}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="New terminal"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Terminal</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col border-t border-border" style={{ height }}>
      {/* Resize handle */}
      <div
        className="h-1 shrink-0 cursor-row-resize bg-border/50 transition-colors hover:bg-primary/40"
        onMouseDown={handleMouseDown}
      />
      {/* Tab bar */}
      <PanelTabBar />
      {/* Tab content — render all tabs to keep terminals alive when switching */}
      <div className="min-h-0 flex-1 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === activeTabId ? "h-full" : "hidden"}
          >
            {tab.type === "logs" && <LogViewer tab={tab} />}
            {tab.type === "shell" && <TerminalViewer tab={tab} />}
            {tab.type === "terminal" && <LocalTerminalViewer tab={tab} />}
          </div>
        ))}
      </div>
    </div>
  );
}
