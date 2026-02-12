import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditableField } from "@/components/ui/editable-field";
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
import type { ResourceType } from "@/types/k8s";
import {
  getGatewayDetail,
  getHTTPRouteDetail,
  getGRPCRouteDetail,
  patchResource,
} from "@/lib/tauri-commands";
import { CollapsibleBadgeList } from "@/components/ui/collapsible-badge-list";
import { ArrowLeft, ChevronRight, FileCode } from "lucide-react";
import { ErrorAlert, SectionHeader, IconButton, StatusDot } from "@/components/atoms";
import { DetailRow } from "@/components/molecules";
import type {
  GatewayDetailInfo,
  GatewayListenerInfo,
  HTTPRouteDetailInfo,
  GRPCRouteDetailInfo,
} from "@/types/k8s";
import { GATEWAY_COORDS, HTTPROUTE_COORDS, GRPCROUTE_COORDS } from "@/lib/resource-coords";

type SubView =
  | null
  | { type: "listener"; name: string }
  | { type: "httproute"; name: string }
  | { type: "grpcroute"; name: string };

function conditionBadgeVariant(status: string) {
  if (status === "True") return "success" as const;
  if (status === "False") return "destructive" as const;
  return "secondary" as const;
}

function ConditionsTable({
  conditions,
}: {
  conditions: { condition_type: string; status: string; reason: string; message: string }[];
}) {
  if (conditions.length === 0) return null;
  return (
    <section>
      <SectionHeader>Conditions</SectionHeader>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conditions.map((c) => (
              <TableRow key={c.condition_type}>
                <TableCell className="font-medium">{c.condition_type}</TableCell>
                <TableCell>
                  <Badge variant={conditionBadgeVariant(c.status)}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{c.reason}</TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                  {c.message}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function EventsTable({
  events,
}: {
  events: { reason: string; message: string; count: number; age: string; event_type: string }[];
}) {
  if (events.length === 0) return null;
  return (
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
            {events.map((ev, i) => (
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
  );
}

// ── Helper: build a merge patch for a single listener field ─────────────────

function buildListenerPatch(
  allListeners: GatewayListenerInfo[],
  listenerName: string,
  field: "protocol" | "port" | "hostname",
  newValue: string,
) {
  const listeners = allListeners.map((l) => {
    const base: Record<string, unknown> = {
      name: l.name,
      protocol: l.protocol,
      port: l.port,
      hostname: l.hostname || undefined,
    };
    if (l.name === listenerName) {
      if (field === "port") {
        base[field] = Number(newValue);
      } else {
        base[field] = newValue;
      }
    }
    return base;
  });
  return { spec: { listeners } };
}

// ── Listener Detail Sub-View ─────────────────────────────────────────────────

function ListenerDetailView({
  listener,
  gatewayName,
  allListeners,
  onFieldSaved,
}: {
  listener: GatewayListenerInfo;
  gatewayName: string;
  allListeners: GatewayListenerInfo[];
  onFieldSaved: () => void;
}) {
  const handleSaveField = async (field: "protocol" | "port" | "hostname", newValue: string) => {
    const patch = buildListenerPatch(allListeners, listener.name, field, newValue);
    await patchResource(GATEWAY_COORDS, gatewayName, patch);
    onFieldSaved();
  };

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader>Properties</SectionHeader>
        <div className="rounded-lg border border-border">
          <div className="px-4">
            <DetailRow label="Name">
              <span className="font-mono">{listener.name}</span>
            </DetailRow>
            <DetailRow label="Gateway">
              <span className="text-primary">{gatewayName}</span>
            </DetailRow>
            <DetailRow label="Protocol">
              <EditableField
                value={listener.protocol}
                onSave={(v) => handleSaveField("protocol", v)}
              />
            </DetailRow>
            <DetailRow label="Port">
              <EditableField
                value={String(listener.port)}
                onSave={(v) => handleSaveField("port", v)}
                inputType="number"
                validate={(v) => {
                  const n = Number(v);
                  if (isNaN(n) || n < 1 || n > 65535) return "Port must be 1-65535";
                  return null;
                }}
                mono
              />
            </DetailRow>
            <DetailRow label="Hostname">
              <EditableField
                value={listener.hostname}
                onSave={(v) => handleSaveField("hostname", v)}
                mono
              />
            </DetailRow>
            {listener.tls_mode && (
              <DetailRow label="TLS Mode">
                <Badge variant="secondary">{listener.tls_mode}</Badge>
              </DetailRow>
            )}
            {listener.tls_certificate_refs.length > 0 && (
              <DetailRow label="Certificate Refs">
                <div className="flex flex-wrap gap-1">
                  {listener.tls_certificate_refs.map((ref_) => (
                    <Badge key={ref_} variant="secondary" className="font-mono">
                      {ref_}
                    </Badge>
                  ))}
                </div>
              </DetailRow>
            )}
            <DetailRow label="Allowed Routes">
              <Badge variant="secondary">{listener.allowed_routes}</Badge>
            </DetailRow>
            <DetailRow label="Attached Routes">
              {listener.attached_routes}
            </DetailRow>
          </div>
        </div>
      </section>

      <ConditionsTable conditions={listener.conditions} />
    </div>
  );
}

// ── HTTPRoute Detail Sub-View ────────────────────────────────────────────────

function HTTPRouteDetailView({ routeName }: { routeName: string }) {
  const setActiveResource = useClusterStore((s) => s.setActiveResource);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);
  const [detail, setDetail] = useState<HTTPRouteDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yamlOpen, setYamlOpen] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getHTTPRouteDetail(routeName);
      setDetail(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [routeName]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorAlert>{error}</ErrorAlert>
    );
  }

  if (!detail) return null;

  const handleSaveHostname = async (index: number, newValue: string) => {
    const hostnames = [...detail.hostnames];
    hostnames[index] = newValue;
    await patchResource(HTTPROUTE_COORDS, routeName, { spec: { hostnames } });
    fetchDetail();
  };

  const handleSavePathValue = async (ruleIdx: number, matchIdx: number, newValue: string) => {
    const rules = detail.rules.map((rule, ri) => ({
      matches: rule.matches.map((m, mi) => {
        const match: Record<string, unknown> = {
          path: { type: m.path_type, value: ri === ruleIdx && mi === matchIdx ? newValue : m.path_value },
        };
        if (m.method) match.method = m.method;
        if (m.headers.length > 0) match.headers = m.headers;
        return match;
      }),
      backendRefs: rule.backend_refs.map((br) => ({
        kind: br.kind,
        name: br.name,
        port: br.port,
        weight: br.weight,
      })),
      filters: rule.filters,
    }));
    await patchResource(HTTPROUTE_COORDS, routeName, { spec: { rules } });
    fetchDetail();
  };

  const handleNavigateToService = (serviceName: string) => {
    setActiveResource("services" as ResourceType);
    setSelectedResourceName(serviceName);
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold">Properties</h3>
          <Button variant="outline" size="sm" onClick={() => setYamlOpen(true)}>
            <FileCode className="h-3.5 w-3.5" />
            Edit YAML
          </Button>
        </div>
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
            <DetailRow label="Hostnames">
              {detail.hostnames.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {detail.hostnames.map((h, i) => (
                    <EditableField
                      key={`${h}-${i}`}
                      value={h}
                      onSave={(v) => handleSaveHostname(i, v)}
                      mono
                    />
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">*</span>
              )}
            </DetailRow>
            <DetailRow label="Parent Refs">
              <div className="flex flex-wrap gap-1">
                {detail.parent_refs.map((pr) => (
                  <Badge
                    key={`${pr.namespace}/${pr.name}/${pr.section_name}`}
                    variant="secondary"
                  >
                    {pr.kind} {pr.name}
                    {pr.section_name && ` / ${pr.section_name}`}
                  </Badge>
                ))}
              </div>
            </DetailRow>
          </div>
        </div>
      </section>

      {/* Rules */}
      {detail.rules.length > 0 && (
        <section>
          <SectionHeader>
            Rules ({detail.rules.length})
          </SectionHeader>
          <div className="space-y-3">
            {detail.rules.map((rule, idx) => (
              <div key={idx} className="rounded-lg border border-border">
                <div className="border-b border-border px-4 py-2 text-sm font-medium">
                  Rule {idx + 1}
                </div>
                <div className="px-4">
                  {rule.matches.length > 0 && (
                    <DetailRow label="Matches">
                      <div className="space-y-1">
                        {rule.matches.map((m, mi) => (
                          <div key={mi} className="flex flex-wrap items-center gap-1">
                            <Badge variant="secondary">{m.path_type}:</Badge>
                            <EditableField
                              value={m.path_value}
                              onSave={(v) => handleSavePathValue(idx, mi, v)}
                              mono
                            />
                            {m.method && (
                              <Badge variant="secondary">{m.method}</Badge>
                            )}
                            {m.headers.map((h) => (
                              <Badge key={h} variant="secondary" className="text-xs">
                                {h}
                              </Badge>
                            ))}
                          </div>
                        ))}
                      </div>
                    </DetailRow>
                  )}
                  <DetailRow label="Backend Refs">
                    <div className="space-y-1">
                      {rule.backend_refs.map((br) => (
                        <div key={br.name} className="flex items-center gap-2">
                          {br.kind === "Service" ? (
                            <button
                              onClick={() => handleNavigateToService(br.name)}
                              className="text-primary hover:underline cursor-pointer"
                            >
                              {br.name}
                            </button>
                          ) : (
                            <span className="text-primary">{br.name}</span>
                          )}
                          <span className="font-mono text-xs text-muted-foreground">
                            :{br.port}
                          </span>
                          {br.weight !== 1 && (
                            <Badge variant="secondary" className="text-xs">
                              weight={br.weight}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </DetailRow>
                  {rule.filters.length > 0 && (
                    <DetailRow label="Filters">
                      <div className="flex flex-wrap gap-1">
                        {rule.filters.map((f, fi) => (
                          <Badge key={fi} variant="secondary">{f}</Badge>
                        ))}
                      </div>
                    </DetailRow>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConditionsTable conditions={detail.conditions} />
      <EventsTable events={detail.events} />

      <YamlEditorDialog
        open={yamlOpen}
        onOpenChange={setYamlOpen}
        resourceCoords={HTTPROUTE_COORDS}
        resourceName={routeName}
        onSaved={fetchDetail}
      />
    </div>
  );
}

// ── GRPCRoute Detail Sub-View ────────────────────────────────────────────────

function GRPCRouteDetailView({ routeName }: { routeName: string }) {
  const setActiveResource = useClusterStore((s) => s.setActiveResource);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);
  const [detail, setDetail] = useState<GRPCRouteDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yamlOpen, setYamlOpen] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getGRPCRouteDetail(routeName);
      setDetail(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [routeName]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorAlert>{error}</ErrorAlert>
    );
  }

  if (!detail) return null;

  const handleSaveHostname = async (index: number, newValue: string) => {
    const hostnames = [...detail.hostnames];
    hostnames[index] = newValue;
    await patchResource(GRPCROUTE_COORDS, routeName, { spec: { hostnames } });
    fetchDetail();
  };

  const handleNavigateToService = (serviceName: string) => {
    setActiveResource("services" as ResourceType);
    setSelectedResourceName(serviceName);
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold">Properties</h3>
          <Button variant="outline" size="sm" onClick={() => setYamlOpen(true)}>
            <FileCode className="h-3.5 w-3.5" />
            Edit YAML
          </Button>
        </div>
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
            <DetailRow label="Hostnames">
              {detail.hostnames.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {detail.hostnames.map((h, i) => (
                    <EditableField
                      key={`${h}-${i}`}
                      value={h}
                      onSave={(v) => handleSaveHostname(i, v)}
                      mono
                    />
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">*</span>
              )}
            </DetailRow>
            <DetailRow label="Parent Refs">
              <div className="flex flex-wrap gap-1">
                {detail.parent_refs.map((pr) => (
                  <Badge
                    key={`${pr.namespace}/${pr.name}/${pr.section_name}`}
                    variant="secondary"
                  >
                    {pr.kind} {pr.name}
                    {pr.section_name && ` / ${pr.section_name}`}
                  </Badge>
                ))}
              </div>
            </DetailRow>
          </div>
        </div>
      </section>

      {/* Rules */}
      {detail.rules.length > 0 && (
        <section>
          <SectionHeader>
            Rules ({detail.rules.length})
          </SectionHeader>
          <div className="space-y-3">
            {detail.rules.map((rule, idx) => (
              <div key={idx} className="rounded-lg border border-border">
                <div className="border-b border-border px-4 py-2 text-sm font-medium">
                  Rule {idx + 1}
                </div>
                <div className="px-4">
                  {rule.matches.length > 0 && (
                    <DetailRow label="Matches">
                      <div className="space-y-1">
                        {rule.matches.map((m, mi) => (
                          <div key={mi} className="flex flex-wrap gap-1">
                            {m.method_service && (
                              <Badge variant="secondary">
                                {m.method_service}/{m.method_method}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {m.match_type}
                            </Badge>
                            {m.headers.map((h) => (
                              <Badge key={h} variant="secondary" className="text-xs">
                                {h}
                              </Badge>
                            ))}
                          </div>
                        ))}
                      </div>
                    </DetailRow>
                  )}
                  <DetailRow label="Backend Refs">
                    <div className="space-y-1">
                      {rule.backend_refs.map((br) => (
                        <div key={br.name} className="flex items-center gap-2">
                          {br.kind === "Service" ? (
                            <button
                              onClick={() => handleNavigateToService(br.name)}
                              className="text-primary hover:underline cursor-pointer"
                            >
                              {br.name}
                            </button>
                          ) : (
                            <span className="text-primary">{br.name}</span>
                          )}
                          <span className="font-mono text-xs text-muted-foreground">
                            :{br.port}
                          </span>
                          {br.weight !== 1 && (
                            <Badge variant="secondary" className="text-xs">
                              weight={br.weight}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </DetailRow>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConditionsTable conditions={detail.conditions} />
      <EventsTable events={detail.events} />

      <YamlEditorDialog
        open={yamlOpen}
        onOpenChange={setYamlOpen}
        resourceCoords={GRPCROUTE_COORDS}
        resourceName={routeName}
        onSaved={fetchDetail}
      />
    </div>
  );
}

// ── Main Gateway Detail ──────────────────────────────────────────────────────

function GatewayMainView({
  detail,
  onSelectListener,
  onSelectHTTPRoute,
  onSelectGRPCRoute,
}: {
  detail: GatewayDetailInfo;
  onSelectListener: (name: string) => void;
  onSelectHTTPRoute: (name: string) => void;
  onSelectGRPCRoute: (name: string) => void;
}) {
  return (
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
            {detail.finalizers.length > 0 && (
              <DetailRow label="Finalizers">
                <div className="flex flex-wrap gap-1">
                  {detail.finalizers.map((f) => (
                    <Badge key={f} variant="secondary">
                      {f}
                    </Badge>
                  ))}
                </div>
              </DetailRow>
            )}
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
            <DetailRow label="Gateway Class">
              <Badge variant="secondary">{detail.gateway_class}</Badge>
            </DetailRow>
            <DetailRow label="Addresses">
              {detail.addresses.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {detail.addresses.map((addr) => (
                    <Badge key={addr.value} variant="secondary" className="font-mono">
                      {addr.value} ({addr.address_type})
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">&lt;none&gt;</span>
              )}
            </DetailRow>
          </div>
        </div>
      </section>

      {/* Listeners */}
      {detail.listeners.length > 0 && (
        <section>
          <SectionHeader>Listeners</SectionHeader>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Attached Routes</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.listeners.map((l) => (
                  <TableRow
                    key={l.name}
                    className="cursor-pointer"
                    onClick={() => onSelectListener(l.name)}
                  >
                    <TableCell className="font-mono text-xs text-primary">
                      {l.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{l.protocol}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.port}</TableCell>
                    <TableCell className="font-mono text-xs">{l.hostname}</TableCell>
                    <TableCell>{l.attached_routes}</TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <ConditionsTable conditions={detail.conditions} />

      {/* HTTP Routes */}
      {detail.http_routes.length > 0 && (
        <section>
          <SectionHeader>
            HTTPRoutes ({detail.http_routes.length})
          </SectionHeader>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Hostnames</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.http_routes.map((route) => (
                  <TableRow
                    key={`${route.namespace}/${route.name}`}
                    className="cursor-pointer"
                    onClick={() => onSelectHTTPRoute(route.name)}
                  >
                    <TableCell className="font-mono text-xs text-primary">
                      {route.name}
                    </TableCell>
                    <TableCell>{route.namespace}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {route.hostnames.length > 0 ? (
                          route.hostnames.map((h) => (
                            <Badge key={h} variant="secondary" className="font-mono text-xs">
                              {h}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">*</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{route.age}</TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* GRPC Routes */}
      {detail.grpc_routes.length > 0 && (
        <section>
          <SectionHeader>
            GRPCRoutes ({detail.grpc_routes.length})
          </SectionHeader>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Hostnames</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.grpc_routes.map((route) => (
                  <TableRow
                    key={`${route.namespace}/${route.name}`}
                    className="cursor-pointer"
                    onClick={() => onSelectGRPCRoute(route.name)}
                  >
                    <TableCell className="font-mono text-xs text-primary">
                      {route.name}
                    </TableCell>
                    <TableCell>{route.namespace}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {route.hostnames.length > 0 ? (
                          route.hostnames.map((h) => (
                            <Badge key={h} variant="secondary" className="font-mono text-xs">
                              {h}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">*</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{route.age}</TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <EventsTable events={detail.events} />
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function GatewayDetail() {
  const selectedGateway = useClusterStore((s) => s.selectedGateway);
  const setSelectedGateway = useClusterStore((s) => s.setSelectedGateway);
  const [detail, setDetail] = useState<GatewayDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subView, setSubView] = useState<SubView>(null);
  const [yamlOpen, setYamlOpen] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!selectedGateway) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getGatewayDetail(selectedGateway);
      setDetail(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedGateway]);

  useEffect(() => {
    fetchDetail();
    setSubView(null);
  }, [fetchDetail]);

  if (!selectedGateway) return null;

  const handleBack = () => {
    if (subView) {
      setSubView(null);
    } else {
      setSelectedGateway(null);
    }
  };

  const subViewLabel = subView
    ? subView.type === "listener"
      ? `Listener: ${subView.name}`
      : subView.type === "httproute"
        ? `HTTPRoute: ${subView.name}`
        : `GRPCRoute: ${subView.name}`
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <IconButton onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </IconButton>
        <span className="text-sm font-semibold">Gateway:</span>
        <span
          className={`truncate font-mono text-sm ${subView ? "cursor-pointer text-primary hover:underline" : ""}`}
          onClick={subView ? () => setSubView(null) : undefined}
        >
          {selectedGateway}
        </span>
        {subViewLabel && (
          <>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-semibold">{subViewLabel}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          {!subView && (
            <Button variant="outline" size="sm" onClick={() => setYamlOpen(true)}>
              <FileCode className="h-3.5 w-3.5" />
              Edit YAML
            </Button>
          )}
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

          {detail && !loading && !subView && (
            <GatewayMainView
              detail={detail}
              onSelectListener={(name) => setSubView({ type: "listener", name })}
              onSelectHTTPRoute={(name) => setSubView({ type: "httproute", name })}
              onSelectGRPCRoute={(name) => setSubView({ type: "grpcroute", name })}
            />
          )}

          {detail && !loading && subView?.type === "listener" && (
            <ListenerDetailView
              listener={detail.listeners.find((l) => l.name === subView.name)!}
              gatewayName={detail.name}
              allListeners={detail.listeners}
              onFieldSaved={fetchDetail}
            />
          )}

          {!loading && subView?.type === "httproute" && (
            <HTTPRouteDetailView routeName={subView.name} />
          )}

          {!loading && subView?.type === "grpcroute" && (
            <GRPCRouteDetailView routeName={subView.name} />
          )}
        </div>
      </ScrollArea>

      <YamlEditorDialog
        open={yamlOpen}
        onOpenChange={setYamlOpen}
        resourceCoords={GATEWAY_COORDS}
        resourceName={selectedGateway}
        onSaved={fetchDetail}
      />
    </div>
  );
}
