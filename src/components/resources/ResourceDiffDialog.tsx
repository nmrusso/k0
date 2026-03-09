import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UnifiedDiffViewer } from "./UnifiedDiffViewer";
import { Loader2, ArrowLeft, Search } from "lucide-react";
import { getResourceYaml, getGenericResources } from "@/lib/tauri-commands";
import type { ResourceCoordinates } from "@/lib/tauri-commands";
import { createUnifiedDiff } from "@/lib/simple-diff";

interface ResourceDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceCoords: ResourceCoordinates;
  sourceResourceName: string;
}

type Step = "pick-target" | "viewing-diff";

export function ResourceDiffDialog({
  open,
  onOpenChange,
  resourceCoords,
  sourceResourceName,
}: ResourceDiffDialogProps) {
  const [step, setStep] = useState<Step>("pick-target");
  const [resources, setResources] = useState<string[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [filter, setFilter] = useState("");
  const [targetName, setTargetName] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("pick-target");
      setTargetName(null);
      setDiff(null);
      setFilter("");
      setError(null);
    }
  }, [open]);

  // Fetch resource list
  useEffect(() => {
    if (!open) return;
    setLoadingResources(true);
    getGenericResources(
      resourceCoords.group,
      resourceCoords.version,
      resourceCoords.kind,
      resourceCoords.plural,
      resourceCoords.clusterScoped ?? false,
    )
      .then((items) => {
        setResources(
          items
            .map((i) => i.name)
            .filter((n) => n !== sourceResourceName)
            .sort(),
        );
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingResources(false));
  }, [open, resourceCoords, sourceResourceName]);

  const handleSelectTarget = async (name: string) => {
    setTargetName(name);
    setLoadingDiff(true);
    setError(null);
    try {
      const [sourceYaml, targetYaml] = await Promise.all([
        getResourceYaml(resourceCoords, sourceResourceName),
        getResourceYaml(resourceCoords, name),
      ]);
      const diffText = createUnifiedDiff(sourceYaml, targetYaml, sourceResourceName, name);
      setDiff(diffText);
      setStep("viewing-diff");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingDiff(false);
    }
  };

  const filtered = filter
    ? resources.filter((r) => r.toLowerCase().includes(filter.toLowerCase()))
    : resources;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "viewing-diff" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setStep("pick-target")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === "pick-target"
              ? `Compare ${sourceResourceName} with...`
              : `Diff: ${sourceResourceName} vs ${targetName}`}
          </DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {step === "pick-target" && (
          <>
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter resources..."
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
            <ScrollArea className="flex-1 max-h-[400px]">
              {loadingResources ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No other resources found
                </div>
              ) : (
                <div className="space-y-0.5 p-1">
                  {filtered.map((name) => (
                    <button
                      key={name}
                      onClick={() => handleSelectTarget(name)}
                      disabled={loadingDiff}
                      className="flex w-full items-center rounded-md px-3 py-2 text-sm font-mono text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {loadingDiff && targetName === name && (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      )}
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {step === "viewing-diff" && diff !== null && (
          <ScrollArea className="flex-1 max-h-[60vh]">
            <UnifiedDiffViewer diff={diff} />
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
