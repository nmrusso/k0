interface UnifiedDiffViewerProps {
  diff: string;
}

export function UnifiedDiffViewer({ diff }: UnifiedDiffViewerProps) {
  if (!diff.trim()) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        No differences found.
      </div>
    );
  }

  const lines = diff.split("\n");

  return (
    <pre className="overflow-auto rounded-md border border-border bg-background p-3 text-xs font-mono leading-relaxed">
      {lines.map((line, i) => {
        let className = "whitespace-pre";
        if (line.startsWith("+")) {
          className += " text-green-400 bg-green-950/30";
        } else if (line.startsWith("-")) {
          className += " text-red-400 bg-red-950/30";
        } else if (line.startsWith("@@")) {
          className += " text-blue-400 bg-blue-950/20";
        }
        return (
          <div key={i} className={className}>
            {line}
          </div>
        );
      })}
    </pre>
  );
}
