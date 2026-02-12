import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { YamlEditorDialog } from "@/components/resources/YamlEditorDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClusterStore } from "@/stores/clusterStore";
import { getIngressDetail } from "@/lib/tauri-commands";
import { CollapsibleBadgeList } from "@/components/ui/collapsible-badge-list";
import { ArrowLeft, FileCode } from "lucide-react";
import { ErrorAlert, SectionHeader, IconButton, StatusDot } from "@/components/atoms";
import { DetailRow } from "@/components/molecules";
import type { IngressDetailInfo } from "@/types/k8s";
import { INGRESS_COORDS } from "@/lib/resource-coords";

export function IngressDetail() {
  const selectedIngress = useClusterStore((s) => s.selectedIngress);
  const setSelectedIngress = useClusterStore((s) => s.setSelectedIngress);
  const [detail, setDetail] = useState<IngressDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yamlOpen, setYamlOpen] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!selectedIngress) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getIngressDetail(selectedIngress);
      setDetail(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedIngress]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (!selectedIngress) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <IconButton onClick={() => setSelectedIngress(null)}>
          <ArrowLeft className="h-4 w-4" />
        </IconButton>
        <span className="text-sm font-semibold">Ingress:</span>
        <span className="truncate font-mono text-sm">{selectedIngress}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setYamlOpen(true)}>
            <FileCode className="h-3.5 w-3.5" />
            Edit YAML
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}

          {error && <ErrorAlert>{error}</ErrorAlert>}

          {detail && !loading && (
            <div className="space-y-6">
              {/* Properties */}
              <section>
                <SectionHeader>Properties</SectionHeader>
                <div className="rounded-lg border border-border">
                  <div className="px-4">
                    <DetailRow label="Created">{detail.created}</DetailRow>
                    <DetailRow label="Name">
                      <span className="font-mono">{detail.name}</span>
                    </DetailRow>
                    <DetailRow label="Namespace">
                      <span className="text-primary">{detail.namespace}</span>
                    </DetailRow>
                    <DetailRow label="Labels">
                      <CollapsibleBadgeList entries={detail.labels} noun="label" />
                    </DetailRow>
                    <DetailRow label="Annotations">
                      <CollapsibleBadgeList entries={detail.annotations} noun="annotation" />
                    </DetailRow>
                    <DetailRow label="Controlled By">
                      {detail.controlled_by.length > 0 ? (
                        detail.controlled_by.map((ref_) => (
                          <span key={ref_.name}>
                            {ref_.kind}{" "}
                            <span className="text-primary">{ref_.name}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </DetailRow>
                    <DetailRow label="Ingress Class">
                      <Badge variant="secondary">{detail.class}</Badge>
                    </DetailRow>
                    <DetailRow label="Default Backend">
                      <span className="font-mono text-xs">{detail.default_backend}</span>
                    </DetailRow>
                    <DetailRow label="Addresses">
                      {detail.addresses.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {detail.addresses.map((addr) => (
                            <Badge key={addr} variant="secondary" className="font-mono">
                              {addr}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">&lt;pending&gt;</span>
                      )}
                    </DetailRow>
                  </div>
                </div>
              </section>

              {/* Rules */}
              {detail.rules.length > 0 && (
                <section>
                  <SectionHeader>Rules</SectionHeader>
                  <div className="space-y-3">
                    {detail.rules.map((rule) => (
                      <div
                        key={rule.host}
                        className="rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                          <span className="text-sm font-medium">Host:</span>
                          <span className="font-mono text-sm text-primary">
                            {rule.host}
                          </span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Path</TableHead>
                              <TableHead>Path Type</TableHead>
                              <TableHead>Backend Service</TableHead>
                              <TableHead>Port</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rule.paths.map((p) => (
                              <TableRow key={p.path}>
                                <TableCell className="font-mono text-xs">
                                  {p.path}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{p.path_type}</Badge>
                                </TableCell>
                                <TableCell className="text-primary">
                                  {p.backend_service}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {p.backend_port}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* TLS */}
              {detail.tls.length > 0 && (
                <section>
                  <SectionHeader>TLS</SectionHeader>
                  <div className="rounded-lg border border-border">
                    <div className="px-4">
                      {detail.tls.map((t) => (
                        <DetailRow key={t.secret_name} label="Secret">
                          <span className="text-primary">{t.secret_name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            Hosts: {t.hosts.join(", ")}
                          </span>
                        </DetailRow>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Events */}
              {detail.events.length > 0 && (
                <section>
                  <SectionHeader>Events</SectionHeader>
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Summary</TableHead>
                          <TableHead>Count</TableHead>
                          <TableHead>Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.events.map((ev, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <div className="flex items-start gap-2">
                                <StatusDot
                                  color={ev.event_type === "Warning" ? "warning" : "muted"}
                                  className="mt-1"
                                />
                                <span className="text-xs">
                                  {ev.reason}: {ev.message}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{ev.count}</TableCell>
                            <TableCell>{ev.age}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      <YamlEditorDialog
        open={yamlOpen}
        onOpenChange={setYamlOpen}
        resourceCoords={INGRESS_COORDS}
        resourceName={selectedIngress}
        onSaved={fetchDetail}
      />
    </div>
  );
}
