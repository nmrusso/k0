import { create } from "zustand";

export type PanelTabType = "logs" | "shell" | "terminal" | "chat" | "activity";

export interface PanelTab {
  id: string;
  type: PanelTabType;
  title: string;
  // Logs-specific
  targetKind?: "pod" | "deployment" | "statefulset" | "daemonset" | "job";
  targetName?: string;
  selectedContainer?: string | null;
  availableContainers?: string[];
  lines?: string[];
  isFollowing?: boolean;
  searchQuery?: string;
  isStreaming?: boolean;
  // Shell/terminal-specific
  podName?: string;
  containerName?: string;
  context?: string;
  namespace?: string;
  // Chat-specific
  resourceKind?: string;
  resourceName?: string;
  resourceContext?: string;
}

const MAX_LOG_LINES = 50_000;

// ---------------------------------------------------------------------------
// Internal helpers — not exported, only used inside the store
// ---------------------------------------------------------------------------

function createTab(type: PanelTabType, fields: Partial<PanelTab>): PanelTab {
  return { id: crypto.randomUUID(), type, title: "", ...fields };
}

function updateTab(tabs: PanelTab[], id: string, patch: Partial<PanelTab>): PanelTab[] {
  return tabs.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

function updateTabFn(
  tabs: PanelTab[],
  id: string,
  fn: (t: PanelTab) => PanelTab,
): PanelTab[] {
  return tabs.map((t) => (t.id === id ? fn(t) : t));
}

function openNewTab(
  set: (fn: (s: PanelState) => Partial<PanelState>) => void,
  tab: PanelTab,
): string {
  set((s) => ({ isOpen: true, tabs: [...s.tabs, tab], activeTabId: tab.id }));
  return tab.id;
}

interface PanelState {
  isOpen: boolean;
  height: number;
  tabs: PanelTab[];
  activeTabId: string | null;
  togglePanel: () => void;
  setHeight: (h: number) => void;
  openLogTab: (params: {
    targetKind: PanelTab["targetKind"];
    targetName: string;
    title: string;
    container?: string | null;
  }) => string;
  openShellTab: (params: {
    podName: string;
    containerName: string;
    context: string;
    namespace: string;
    title: string;
  }) => string;
  openChatTab: (params: {
    resourceKind: string;
    resourceName: string;
    resourceContext: string;
    context?: string;
    namespace?: string;
  }) => string;
  openTerminalTab: (params?: {
    context?: string;
    namespace?: string;
  }) => string;
  openActivityTab: () => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  appendLogLines: (tabId: string, lines: string[]) => void;
  clearLogLines: (tabId: string) => void;
  setFollowing: (tabId: string, following: boolean) => void;
  setSearchQuery: (tabId: string, query: string) => void;
  setSelectedContainer: (tabId: string, container: string | null) => void;
  setStreaming: (tabId: string, streaming: boolean) => void;
  setAvailableContainers: (tabId: string, containers: string[]) => void;
}

export const usePanelStore = create<PanelState>((set, get) => ({
  isOpen: false,
  height: 300,
  tabs: [],
  activeTabId: null,

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),

  setHeight: (h) => set({ height: h }),

  openLogTab: ({ targetKind, targetName, title, container }) =>
    openNewTab(set, createTab("logs", {
      title, targetKind, targetName,
      selectedContainer: container ?? null,
      availableContainers: [],
      lines: [],
      isFollowing: true,
      searchQuery: "",
      isStreaming: true,
    })),

  openShellTab: ({ podName, containerName, context, namespace, title }) =>
    openNewTab(set, createTab("shell", { title, podName, containerName, context, namespace })),

  openChatTab: ({ resourceKind, resourceName, resourceContext, context, namespace }) =>
    openNewTab(set, createTab("chat", {
      title: `Ask Claude: ${resourceKind}/${resourceName}`,
      resourceKind,
      resourceName,
      resourceContext,
      context: context ?? undefined,
      namespace: namespace ?? undefined,
    })),

  openTerminalTab: (params) => {
    const existingTerminals = get().tabs.filter((t: PanelTab) => t.type === "terminal");
    const num = existingTerminals.length + 1;
    const ctxShort = params?.context
      ? params.context.length > 20 ? params.context.slice(-20) : params.context
      : "";
    const title = ctxShort ? `Terminal ${num} (${ctxShort})` : `Terminal ${num}`;
    return openNewTab(set, createTab("terminal", {
      title,
      context: params?.context ?? undefined,
      namespace: params?.namespace ?? undefined,
    }));
  },

  openActivityTab: () => {
    const existing = get().tabs.find((t: PanelTab) => t.type === "activity");
    if (existing) {
      set({ isOpen: true, activeTabId: existing.id });
      return existing.id;
    }
    const tab: PanelTab = { id: "activity", type: "activity", title: "Activity" };
    set((s) => ({ isOpen: true, tabs: [...s.tabs, tab], activeTabId: tab.id }));
    return tab.id;
  },

  closeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      let activeTabId = s.activeTabId;
      if (activeTabId === id) {
        activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
      }
      return {
        tabs,
        activeTabId,
        isOpen: tabs.length > 0,
      };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  appendLogLines: (tabId, lines) =>
    set((s) => ({
      tabs: updateTabFn(s.tabs, tabId, (t) => {
        const combined = [...(t.lines || []), ...lines];
        return {
          ...t,
          lines: combined.length > MAX_LOG_LINES
            ? combined.slice(combined.length - MAX_LOG_LINES)
            : combined,
        };
      }),
    })),

  clearLogLines: (tabId) =>
    set((s) => ({ tabs: updateTab(s.tabs, tabId, { lines: [] }) })),

  setFollowing: (tabId, following) =>
    set((s) => ({ tabs: updateTab(s.tabs, tabId, { isFollowing: following }) })),

  setSearchQuery: (tabId, query) =>
    set((s) => ({ tabs: updateTab(s.tabs, tabId, { searchQuery: query }) })),

  setSelectedContainer: (tabId, container) =>
    set((s) => ({ tabs: updateTab(s.tabs, tabId, { selectedContainer: container }) })),

  setStreaming: (tabId, streaming) =>
    set((s) => ({ tabs: updateTab(s.tabs, tabId, { isStreaming: streaming }) })),

  setAvailableContainers: (tabId, containers) =>
    set((s) => ({ tabs: updateTab(s.tabs, tabId, { availableContainers: containers }) })),
}));
