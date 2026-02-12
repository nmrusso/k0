import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleBadgeListProps {
  entries: Record<string, string>;
  noun: string;
}

export function CollapsibleBadgeList({ entries, noun }: CollapsibleBadgeListProps) {
  const [expanded, setExpanded] = useState(false);
  const keys = Object.keys(entries);

  if (keys.length === 0) {
    return <span className="text-muted-foreground">None</span>;
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1 text-sm hover:text-primary transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        {keys.length} {noun}{keys.length !== 1 ? "s" : ""}
      </button>
      {expanded && (
        <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
          {Object.entries(entries).map(([k, v]) => (
            <Badge key={k} variant="secondary" className="max-w-full whitespace-normal break-all">
              {k}={v}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
