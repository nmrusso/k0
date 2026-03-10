import { useState, useCallback } from "react";

/**
 * Manages open/close state for a modal that optionally carries a value.
 *
 * Usage (no value):
 *   const modal = useModalState();
 *   <Dialog open={modal.isOpen} onOpenChange={modal.setOpen} />
 *   <Button onClick={modal.open} />
 *
 * Usage (with value):
 *   const modal = useModalState<string>();
 *   <Dialog open={modal.isOpen} onOpenChange={modal.setOpen} name={modal.value ?? ""} />
 *   <Button onClick={() => modal.open("my-deployment")} />
 */
export function useModalState<T = void>() {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState<T | null>(null);

  const open = useCallback((val?: T) => {
    if (val !== undefined) setValue(val as T);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setValue(null);
  }, []);

  return {
    isOpen,
    setOpen: (open: boolean) => { if (!open) close(); else setIsOpen(true); },
    value,
    open,
    close,
  };
}
