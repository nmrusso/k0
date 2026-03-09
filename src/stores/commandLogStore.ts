import { create } from "zustand";

export type LogStatus = "running" | "success" | "error";

export interface LogEntry {
  id: string;
  timestamp: Date;
  label: string;
  status: LogStatus;
  error?: string;
  durationMs?: number;
}

interface CommandLogState {
  entries: LogEntry[];
  /** Start a command log entry, returns its id */
  begin: (label: string) => string;
  /** Mark an entry as succeeded */
  succeed: (id: string, durationMs: number) => void;
  /** Mark an entry as failed */
  fail: (id: string, durationMs: number, error: string) => void;
  clear: () => void;
}

const MAX_ENTRIES = 500;

export const useCommandLogStore = create<CommandLogState>((set) => ({
  entries: [],

  begin: (label) => {
    const id = crypto.randomUUID();
    const entry: LogEntry = { id, timestamp: new Date(), label, status: "running" };
    set((s) => ({
      entries: [...s.entries.slice(-MAX_ENTRIES + 1), entry],
    }));
    return id;
  },

  succeed: (id, durationMs) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === id ? { ...e, status: "success", durationMs } : e,
      ),
    })),

  fail: (id, durationMs, error) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === id ? { ...e, status: "error", durationMs, error } : e,
      ),
    })),

  clear: () => set({ entries: [] }),
}));

/** Helper: wrap an async call with log bookkeeping */
export function withLog<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const store = useCommandLogStore.getState();
  const id = store.begin(label);
  const start = Date.now();
  return fn().then(
    (result) => {
      store.succeed(id, Date.now() - start);
      return result;
    },
    (err) => {
      store.fail(id, Date.now() - start, String(err));
      throw err;
    },
  );
}
