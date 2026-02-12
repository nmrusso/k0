import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableFieldProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  inputType?: "text" | "number";
  validate?: (value: string) => string | null;
  className?: string;
  mono?: boolean;
}

export function EditableField({
  value,
  onSave,
  inputType = "text",
  validate,
  className,
  mono = false,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Sync draft when value changes externally
  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  const startEditing = () => {
    setDraft(value);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
    setError(null);
  };

  const save = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    if (validate) {
      const validationError = validate(draft);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      cancel();
    }
  };

  if (editing) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            type={inputType}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={cn("h-7 text-xs", mono && "font-mono")}
          />
          {saving ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <>
              <button
                onClick={save}
                className="rounded p-0.5 text-green-500 transition-colors hover:bg-green-500/10"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={cancel}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }

  return (
    <span
      className={cn(
        "group inline-flex cursor-pointer items-center gap-1.5 rounded px-1 -mx-1 transition-colors hover:bg-accent",
        className,
      )}
      onClick={startEditing}
    >
      <span className={cn(mono && "font-mono")}>{value || "\u00A0"}</span>
      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </span>
  );
}
