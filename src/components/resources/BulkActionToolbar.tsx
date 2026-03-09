import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface BulkAction {
  label: string;
  icon: React.ReactNode;
  variant: "default" | "destructive";
  onClick: () => void;
  loading?: boolean;
}

interface BulkActionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: BulkAction[];
}

export function BulkActionToolbar({
  selectedCount,
  onClearSelection,
  actions,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-sm mb-2">
      <span className="text-sm font-medium">
        {selectedCount} selected
      </span>
      <div className="flex items-center gap-1">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant === "destructive" ? "destructive" : "outline"}
            size="sm"
            onClick={action.onClick}
            disabled={action.loading}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
      <button
        onClick={onClearSelection}
        className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <X className="h-3 w-3" />
        Clear
      </button>
    </div>
  );
}
