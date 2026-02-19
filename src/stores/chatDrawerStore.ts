import { create } from "zustand";

interface ChatDrawerState {
  isOpen: boolean;
  sessionId: string | null;
  resourceKind: string | null;
  resourceName: string | null;
  resourceContext: string | null;
  openDrawer: (params: {
    resourceKind: string;
    resourceName: string;
    resourceContext: string;
  }) => void;
  closeDrawer: () => void;
}

export const useChatDrawerStore = create<ChatDrawerState>((set) => ({
  isOpen: false,
  sessionId: null,
  resourceKind: null,
  resourceName: null,
  resourceContext: null,

  openDrawer: ({ resourceKind, resourceName, resourceContext }) => {
    const sessionId = crypto.randomUUID();
    set({
      isOpen: true,
      sessionId,
      resourceKind,
      resourceName,
      resourceContext,
    });
  },

  closeDrawer: () =>
    set({
      isOpen: false,
      sessionId: null,
      resourceKind: null,
      resourceName: null,
      resourceContext: null,
    }),
}));
