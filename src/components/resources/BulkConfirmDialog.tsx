import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface BulkConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: string;
  resourceNames: string[];
  onConfirm: () => Promise<void>;
}

export function BulkConfirmDialog({
  open,
  onOpenChange,
  action,
  resourceNames,
  onConfirm,
}: BulkConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">{action} {resourceNames.length} resources</DialogTitle>
          <DialogDescription>
            This action will {action} the following resources:
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[200px]">
          <ul className="space-y-1 text-sm font-mono">
            {resourceNames.map((name) => (
              <li key={name} className="rounded bg-muted/50 px-2 py-1 text-xs">
                {name}
              </li>
            ))}
          </ul>
        </ScrollArea>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {action}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
