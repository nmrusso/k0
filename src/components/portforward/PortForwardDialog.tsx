import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { startPortForward, stopPortForward, listPortForwards } from "@/lib/tauri-commands";
import { Loader2, Play, Square, ExternalLink, Copy, Check } from "lucide-react";
import type { PortForwardEntry } from "@/types/k8s";

interface PortForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetKind: string;
  targetName: string;
  defaultPort?: number;
}

export function PortForwardDialog({
  open,
  onOpenChange,
  targetKind,
  targetName,
  defaultPort,
}: PortForwardDialogProps) {
  const [localPort, setLocalPort] = useState(String(defaultPort || ""));
  const [remotePort, setRemotePort] = useState(String(defaultPort || ""));
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeForwards, setActiveForwards] = useState<PortForwardEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refreshForwards = useCallback(async () => {
    try {
      const all = await listPortForwards();
      // Filter to show forwards for this target
      setActiveForwards(
        all.filter(
          (pf) => pf.target_name === targetName && pf.target_kind === targetKind,
        ),
      );
    } catch {
      // ignore
    }
  }, [targetKind, targetName]);

  useEffect(() => {
    if (open) {
      refreshForwards();
      if (defaultPort) {
        setLocalPort(String(defaultPort));
        setRemotePort(String(defaultPort));
      }
    }
  }, [open, refreshForwards, defaultPort]);

  const handleStart = async () => {
    const remote = parseInt(remotePort, 10);
    const local = parseInt(localPort, 10);
    if (isNaN(remote) || remote <= 0) {
      setError("Invalid remote port");
      return;
    }
    if (isNaN(local) || local <= 0) {
      setError("Invalid local port");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      await startPortForward(targetKind, targetName, remote, local);
      await refreshForwards();
    } catch (e) {
      setError(String(e));
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopPortForward(id);
      await refreshForwards();
    } catch {
      // ignore
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Port Forward</DialogTitle>
          <DialogDescription>
            Forward ports for {targetKind}/{targetName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Active forwards */}
          {activeForwards.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Active Forwards</label>
              {activeForwards.map((pf) => (
                <div
                  key={pf.id}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="success" className="text-xs">Active</Badge>
                    <span className="font-mono text-sm">
                      localhost:{pf.local_port}
                    </span>
                    <span className="text-muted-foreground">-&gt;</span>
                    <span className="font-mono text-sm">
                      {pf.remote_port}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        window.open(`http://localhost:${pf.local_port}`, "_blank");
                      }}
                      title="Open in browser"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        navigator.clipboard.writeText(`http://localhost:${pf.local_port}`);
                        setCopiedId(pf.id);
                        setTimeout(() => setCopiedId(null), 1500);
                      }}
                      title={copiedId === pf.id ? "Copied!" : "Copy URL"}
                    >
                      {copiedId === pf.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => handleStop(pf.id)}
                      title="Stop"
                    >
                      <Square className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New port forward */}
          <div className="space-y-2">
            <label className="text-sm font-medium">New Port Forward</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">Local Port</label>
                <Input
                  type="number"
                  value={localPort}
                  onChange={(e) => setLocalPort(e.target.value)}
                  placeholder="8080"
                  min={1}
                  max={65535}
                />
              </div>
              <span className="mt-5 text-muted-foreground">-&gt;</span>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">Remote Port</label>
                <Input
                  type="number"
                  value={remotePort}
                  onChange={(e) => setRemotePort(e.target.value)}
                  placeholder="8080"
                  min={1}
                  max={65535}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button onClick={handleStart} disabled={starting} className="w-full">
            {starting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-4 w-4" />
            )}
            Start Port Forward
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
