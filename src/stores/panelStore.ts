import { create } from "zustand";

export type PanelTabType = "logs" | "shell" | "terminal";

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
}

const MAX_LOG_LINES = 50_000;

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
  // openChatTab: (params?: {
  //   context?: string;
  //   namespace?: string;
  // }) => string;
  openTerminalTab: (params?: {
    context?: string;
    namespace?: string;
  }) => string;
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

export const usePanelStore = create<PanelState>((set) => ({
  isOpen: false,
  height: 300,
  tabs: [],
  activeTabId: null,

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),

  setHeight: (h) => set({ height: h }),

  openLogTab: ({ targetKind, targetName, title, container }) => {
    const id = crypto.randomUUID();
    const tab: PanelTab = {
      id,
      type: "logs",
      title,
      targetKind,
      targetName,
      selectedContainer: container ?? null,
      availableContainers: [],
      lines: [],
      isFollowing: true,
      searchQuery: "",
      isStreaming: true,
    };
    set((s) => ({
      isOpen: true,
      tabs: [...s.tabs, tab],
      activeTabId: id,
    }));
    return id;
  },

  openShellTab: ({ podName, containerName, context, namespace, title }) => {
    const id = crypto.randomUUID();
    const tab: PanelTab = {
      id,
      type: "shell",
      title,
      podName,
      containerName,
      context,
      namespace,
    };
    set((s) => ({
      isOpen: true,
      tabs: [...s.tabs, tab],
      activeTabId: id,
    }));
    return id;
  },

  // openChatTab: (params) => {
  //   const id = crypto.randomUUID();
  //   const existingChats = usePanelStore.getState().tabs.filter((t) => t.type === "chat");
  //   const num = existingChats.length + 1;
  //   const title = `Chat ${num}`;
  //   const tab: PanelTab = {
  //     id,
  //     type: "chat",
  //     title,
  //     context: params?.context ?? undefined,
  //     namespace: params?.namespace ?? undefined,
  //   };
  //   set((s) => ({
  //     isOpen: true,
  //     tabs: [...s.tabs, tab],
  //     activeTabId: id,
  //   }));
  //   return id;
  // },

  openTerminalTab: (params) => {
    const id = crypto.randomUUID();
    const existingTerminals = usePanelStore.getState().tabs.filter((t) => t.type === "terminal");
    const num = existingTerminals.length + 1;
    const ctxShort = params?.context
      ? params.context.length > 20
        ? params.context.slice(-20)
        : params.context
      : "";
    const title = ctxShort ? `Terminal ${num} (${ctxShort})` : `Terminal ${num}`;
    const tab: PanelTab = {
      id,
      type: "terminal",
      title,
      context: params?.context ?? undefined,
      namespace: params?.namespace ?? undefined,
    };
    set((s) => ({
      isOpen: true,
      tabs: [...s.tabs, tab],
      activeTabId: id,
    }));
    return id;
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
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const combined = [...(t.lines || []), ...lines];
        return {
          ...t,
          lines:
            combined.length > MAX_LOG_LINES
              ? combined.slice(combined.length - MAX_LOG_LINES)
              : combined,
        };
      }),
    })),

  clearLogLines: (tabId) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, lines: [] } : t)),
    })),

  setFollowing: (tabId, following) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, isFollowing: following } : t,
      ),
    })),

  setSearchQuery: (tabId, query) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, searchQuery: query } : t,
      ),
    })),

  setSelectedContainer: (tabId, container) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, selectedContainer: container } : t,
      ),
    })),

  setStreaming: (tabId, streaming) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, isStreaming: streaming } : t,
      ),
    })),

  setAvailableContainers: (tabId, containers) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, availableContainers: containers } : t,
      ),
    })),
}));
