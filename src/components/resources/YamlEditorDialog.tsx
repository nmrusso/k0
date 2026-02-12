import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { YamlEditor } from "@/components/ui/yaml-editor";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import {
  getResourceYaml,
  updateResourceYaml,
  type ResourceCoordinates,
} from "@/lib/tauri-commands";

interface YamlEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceCoords: ResourceCoordinates;
  resourceName: string;
  onSaved?: () => void;
}

export function YamlEditorDialog({
  open,
  onOpenChange,
  resourceCoords,
  resourceName,
  onSaved,
}: YamlEditorDialogProps) {
  const [yaml, setYaml] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchYaml = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const content = await getResourceYaml(resourceCoords, resourceName);
      setYaml(content);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [resourceCoords, resourceName]);

  useEffect(() => {
    if (open) {
      fetchYaml();
    }
  }, [open, fetchYaml]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateResourceYaml(resourceCoords, resourceName, yaml);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Edit {resourceCoords.kind}: {resourceName}
          </DialogTitle>
          <DialogDescription>
            Edit the YAML definition and save to apply changes.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <YamlEditor
            value={yaml}
            onChange={setYaml}
            readOnly={saving}
          />
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="break-all">{error}</p>
              {error.toLowerCase().includes("conflict") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={fetchYaml}
                >
                  <RefreshCw className="h-3 w-3" />
                  Reload
                </Button>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
