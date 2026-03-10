import { useState } from "react";
import { deleteResource } from "@/lib/tauri-commands";
import type { ResourceCoordinates } from "@/lib/tauri-commands";

/**
 * Encapsulates single-resource delete flow:
 * open dialog → confirm → call deleteResource → callback.
 *
 * Usage:
 *   const del = useResourceDelete(CRONJOB_COORDS, refresh);
 *   // In row: onClick={() => del.open(item.name)}
 *   // In JSX: <del.Dialog />
 */
export function useResourceDelete(coords: ResourceCoordinates, onDeleted: () => void) {
  const [target, setTarget] = useState<string | null>(null);

  const open = (name: string) => setTarget(name);
  const close = () => setTarget(null);

  const confirm = async () => {
    if (!target) return;
    await deleteResource(coords, target);
    onDeleted();
  };

  return {
    target,
    open,
    close,
    confirm,
    /** Spread onto BulkConfirmDialog: <BulkConfirmDialog {...del.dialogProps} /> */
    dialogProps: {
      open: !!target,
      onOpenChange: (isOpen: boolean) => { if (!isOpen) close(); },
      action: "delete" as const,
      resourceNames: target ? [target] : [],
      onConfirm: confirm,
    },
  };
}
