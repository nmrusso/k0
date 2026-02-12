import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  helmGetHistory,
  helmRollback,
  helmDiffRevisions,
  helmGetValues,
  helmGetManifest,
  helmDiffLocal,
} from "@/lib/tauri-commands";
import type { HelmRevision } from "@/types/k8s";
import { UnifiedDiffViewer } from "./UnifiedDiffViewer";
import { ArrowDownToLine, FileText, FileDiff, RotateCcw, Loader2, GitCompareArrows } from "lucide-react";

interface HelmReleaseDetailProps {
  releaseName: string;
  onRollbackComplete?: () => void;
}

export function HelmReleaseDetail({ releaseName, onRollbackComplete }: HelmReleaseDetailProps) {
  const [revisions, setRevisions] = useState<HelmRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerContent, setViewerContent] = useState("");
  const [viewerMode, setViewerMode] = useState<"text" | "diff">("text");
  const [viewerLoading, setViewerLoading] = useState(false);

  // Rollback confirmation
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackRevision, setRollbackRevision] = useState<number | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await helmGetHistory(releaseName);
      setRevisions(data.sort((a, b) => b.revision - a.revision));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [releaseName]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleLocalDiff = async (revision: number) => {
    setViewerTitle(`Local Diff: ${releaseName} (rev ${revision}) vs local chart`);
    setViewerMode("diff");
    setViewerContent("");
    setViewerOpen(true);
    setViewerLoading(true);
    try {
      const diff = await helmDiffLocal(releaseName, revision);
      setViewerContent(diff);
    } catch (e) {
      setViewerContent(`Error: ${e}`);
      setViewerMode("text");
    } finally {
      setViewerLoading(false);
    }
  };

  const handleDiff = async (revision: number) => {
    const prev = revision - 1;
    if (prev < 1) return;
    setViewerTitle(`Diff: revision ${prev} → ${revision}`);
    setViewerMode("diff");
    setViewerContent("");
    setViewerOpen(true);
    setViewerLoading(true);
    try {
      const diff = await helmDiffRevisions(releaseName, prev, revision);
      setViewerContent(diff);
    } catch (e) {
      setViewerContent(`Error: ${e}`);
      setViewerMode("text");
    } finally {
      setViewerLoading(false);
    }
  };

  const handleValues = async (revision: number) => {
    setViewerTitle(`Values: ${releaseName} (revision ${revision})`);
    setViewerMode("text");
    setViewerContent("");
    setViewerOpen(true);
    setViewerLoading(true);
    try {
      const values = await helmGetValues(releaseName, revision);
      setViewerContent(values);
    } catch (e) {
      setViewerContent(`Error: ${e}`);
    } finally {
      setViewerLoading(false);
    }
  };

  const handleManifest = async (revision: number) => {
    setViewerTitle(`Manifest: ${releaseName} (revision ${revision})`);
    setViewerMode("text");
    setViewerContent("");
    setViewerOpen(true);
    setViewerLoading(true);
    try {
      const manifest = await helmGetManifest(releaseName, revision);
      setViewerContent(manifest);
    } catch (e) {
      setViewerContent(`Error: ${e}`);
    } finally {
      setViewerLoading(false);
    }
  };

  const handleRollback = async () => {
    if (rollbackRevision === null) return;
    setRollbackLoading(true);
    try {
      await helmRollback(releaseName, rollbackRevision);
      setRollbackOpen(false);
      setRollbackRevision(null);
      fetchHistory();
      onRollbackComplete?.();
    } catch (e) {
      setError(String(e));
      setRollbackOpen(false);
    } finally {
      setRollbackLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  const maxRevision = revisions.length > 0 ? revisions[0].revision : 0;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">
        Revision History: {releaseName}
      </h3>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rev</TableHead>
            <TableHead>Chart</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {revisions.map((rev) => (
            <TableRow key={rev.revision}>
              <TableCell className="font-mono text-xs">
                {rev.revision}
                {rev.revision === maxRevision && (
                  <Badge variant="outline" className="ml-1 text-[10px]">current</Badge>
                )}
              </TableCell>
              <TableCell className="text-xs">{rev.chart}</TableCell>
              <TableCell>
                <Badge
                  variant={rev.status === "deployed" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {rev.status}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                {rev.description}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{rev.updated}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {rev.revision > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleDiff(rev.revision)}
                      title="Diff with previous revision"
                    >
                      <FileDiff className="mr-1 h-3 w-3" />
                      Diff
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleValues(rev.revision)}
                    title="View values"
                  >
                    <FileText className="mr-1 h-3 w-3" />
                    Values
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleManifest(rev.revision)}
                    title="View manifest"
                  >
                    <ArrowDownToLine className="mr-1 h-3 w-3" />
                    Manifest
                  </Button>
                  {rev.revision === maxRevision && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300"
                      onClick={() => handleLocalDiff(rev.revision)}
                      title="Diff deployed manifest vs local chart template"
                    >
                      <GitCompareArrows className="mr-1 h-3 w-3" />
                      Local Diff
                    </Button>
                  )}
                  {rev.revision !== maxRevision && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-orange-400 hover:text-orange-300"
                      onClick={() => {
                        setRollbackRevision(rev.revision);
                        setRollbackOpen(true);
                      }}
                      title="Rollback to this revision"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Rollback
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Viewer dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewerTitle}</DialogTitle>
            <DialogDescription>
              {viewerMode === "diff" ? "Unified diff between revisions" : "Raw output from Helm"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {viewerLoading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : viewerMode === "diff" ? (
              <UnifiedDiffViewer diff={viewerContent} />
            ) : (
              <pre className="overflow-auto rounded-md border border-border bg-background p-3 text-xs font-mono leading-relaxed whitespace-pre">
                {viewerContent}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rollback confirmation */}
      <Dialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
            <DialogDescription>
              Roll back <strong>{releaseName}</strong> to revision{" "}
              <strong>{rollbackRevision}</strong>? This will create a new revision.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setRollbackOpen(false)} disabled={rollbackLoading}>
              Cancel
            </Button>
            <Button onClick={handleRollback} disabled={rollbackLoading}>
              {rollbackLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rollback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
