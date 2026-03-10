import { useState } from "react";
import { useCommandLogStore, type LogEntry } from "@/stores/commandLogStore";
import { CheckCircle2, XCircle, Loader2, Trash2, Copy, Check, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy command"
      className="shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
    >
      {copied
        ? <Check className="h-3 w-3 text-green-500" />
        : <Copy className="h-3 w-3" />}
    </button>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasCommand = !!entry.command;
  const copyText = entry.command ?? entry.label;

  return (
    <div className="border-b border-border/50">
      <div
        className={cn(
          "group flex items-start gap-2.5 px-3 py-1.5 transition-colors",
          hasCommand ? "cursor-pointer hover:bg-muted/30" : "hover:bg-muted/20",
        )}
        onClick={() => hasCommand && setExpanded((v) => !v)}
      >
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
        <CopyButton text={copyText} />
        {hasCommand && (
          <ChevronDown
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform",
              expanded && "rotate-180",
            )}
          />
        )}
      </div>

      {entry.status === "error" && entry.error && (
        <div className="px-10 pb-1.5 text-[11px] text-destructive break-all">
          {entry.error}
        </div>
      )}

      {expanded && entry.command && (
        <div className="mx-3 mb-2 rounded bg-muted/50 border border-border/50">
          <div className="flex items-start justify-between gap-2 px-3 py-2">
            <pre className="flex-1 whitespace-pre-wrap break-all text-[11px] text-foreground/80 font-mono leading-relaxed">
              {entry.command}
            </pre>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(entry.command!);
              }}
              title="Copy command"
              className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
              <LogRow key={entry.id} entry={entry} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
