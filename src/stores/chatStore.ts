import { create } from "zustand";

export interface ActionRequest {
  actionId: string;
  actionType: string;
  description: string;
  params: Record<string, unknown>;
  status: "pending" | "executing" | "executed" | "failed" | "rejected";
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  actionRequest?: ActionRequest;
}

export interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  isStreaming: boolean;
}

interface ChatState {
  sessions: Record<string, ChatSession>;

  getOrCreateSession: (sessionId: string) => ChatSession;
  addUserMessage: (sessionId: string, content: string) => void;
  startAssistantMessage: (sessionId: string) => string;
  appendAssistantText: (sessionId: string, messageId: string, text: string) => void;
  finalizeAssistantMessage: (sessionId: string, messageId: string) => void;
  addActionRequest: (sessionId: string, action: ActionRequest) => void;
  updateActionStatus: (
    sessionId: string,
    actionId: string,
    status: ActionRequest["status"],
    result?: string,
  ) => void;
  setStreaming: (sessionId: string, streaming: boolean) => void;
  clearSession: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: {},

  getOrCreateSession: (sessionId) => {
    const existing = get().sessions[sessionId];
    if (existing) return existing;
    const session: ChatSession = {
      sessionId,
      messages: [],
      isStreaming: false,
    };
    set((s) => ({
      sessions: { ...s.sessions, [sessionId]: session },
    }));
    return session;
  },

  addUserMessage: (sessionId, content) =>
    set((s) => {
      const session = s.sessions[sessionId] ?? {
        sessionId,
        messages: [],
        isStreaming: false,
      };
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: Date.now(),
      };
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            messages: [...session.messages, message],
          },
        },
      };
    }),

  startAssistantMessage: (sessionId) => {
    const id = crypto.randomUUID();
    set((s) => {
      const session = s.sessions[sessionId] ?? {
        sessionId,
        messages: [],
        isStreaming: false,
      };
      const message: ChatMessage = {
        id,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            messages: [...session.messages, message],
            isStreaming: true,
          },
        },
      };
    });
    return id;
  },

  appendAssistantText: (sessionId, messageId, text) =>
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            messages: session.messages.map((m) =>
              m.id === messageId ? { ...m, content: m.content + text } : m,
            ),
          },
        },
      };
    }),

  finalizeAssistantMessage: (sessionId, messageId) =>
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            messages: session.messages.map((m) =>
              m.id === messageId ? { ...m, isStreaming: false } : m,
            ),
            isStreaming: false,
          },
        },
      };
    }),

  addActionRequest: (sessionId, action) =>
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        actionRequest: action,
      };
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            messages: [...session.messages, message],
          },
        },
      };
    }),

  updateActionStatus: (sessionId, actionId, status, result) =>
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            messages: session.messages.map((m) =>
              m.actionRequest?.actionId === actionId
                ? {
                    ...m,
                    actionRequest: { ...m.actionRequest, status, result },
                  }
                : m,
            ),
          },
        },
      };
    }),

  setStreaming: (sessionId, streaming) =>
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: { ...session, isStreaming: streaming },
        },
      };
    }),

  clearSession: (sessionId) =>
    set((s) => {
      const { [sessionId]: _, ...rest } = s.sessions;
      return { sessions: rest };
    }),
}));
