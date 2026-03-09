import { useCommandLogStore, type LogEntry } from "@/stores/commandLogStore";
import { CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

function StatusIcon({ status }: { status: LogEntry["status"] }) {
  if (status === "running")
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />;
  if (status === "success")
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", { hour12: false });
}

export function ActivityViewer() {
  const entries = useCommandLogStore((s) => s.entries);
  const clear = useCommandLogStore((s) => s.clear);

  return (
    <div className="flex h-full flex-col font-mono text-xs">
      <div className="flex items-center justify-between border-b border-border px-3 py-1 shrink-0">
        <span className="text-muted-foreground text-[11px]">
          {entries.length} command{entries.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={clear}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Clear log"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground text-[11px]">
          No commands yet
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div>
            {[...entries].reverse().map((entry) => (
              <div key={entry.id} className="border-b border-border/50">
                <div className="flex items-start gap-2.5 px-3 py-1.5 hover:bg-muted/30 transition-colors">
                  <StatusIcon status={entry.status} />
                  <span className="shrink-0 text-muted-foreground/60 tabular-nums">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className="flex-1 break-all">{entry.label}</span>
                  {entry.durationMs !== undefined && (
                    <span className="shrink-0 text-muted-foreground/50 tabular-nums">
                      {entry.durationMs < 1000
                        ? `${entry.durationMs}ms`
                        : `${(entry.durationMs / 1000).toFixed(1)}s`}
                    </span>
                  )}
                </div>
                {entry.status === "error" && entry.error && (
                  <div className="px-10 pb-1.5 text-[11px] text-destructive break-all">
                    {entry.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
