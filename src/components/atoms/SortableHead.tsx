import { TableHead } from "@/components/ui/table";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortProps } from "@/hooks/useTableSort";

export function SortableHead({
  label,
  className,
  isSorted,
  sortDir,
  onClick,
}: { label: string; className?: string } & SortProps) {
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground", className)}
      onClick={onClick}
    >
      <span className="flex items-center gap-1">
        {label}
        {isSorted && (
          sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        )}
      </span>
    </TableHead>
  );
}
