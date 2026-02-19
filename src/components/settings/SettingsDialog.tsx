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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAllConfig, setConfig, deleteConfig, getConfig, getContexts } from "@/lib/tauri-commands";
import { Loader2, Save, Trash2, Plus, X } from "lucide-react";
import type { ContextInfo } from "@/types/k8s";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contexts, setContexts] = useState<ContextInfo[]>([]);

  const [defaultContext, setDefaultContext] = useState("");
  const [defaultNamespace, setDefaultNamespace] = useState("");

  // Terminal settings
  const [terminalShellPath, setTerminalShellPath] = useState("/bin/sh");
  const [terminalFontSize, setTerminalFontSize] = useState("13");
  const [terminalFontFamily, setTerminalFontFamily] = useState(
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  );

  // Claude integration settings
  const [claudePermissionMode, setClaudePermissionMode] = useState("text_only");

  // Sidebar default expanded categories
  const ALL_SIDEBAR_CATEGORIES = [
    "Namespaces", "Workloads", "Network", "Config", "Storage", "Access Control", "Custom Resources",
  ];
  const [defaultExpanded, setDefaultExpanded] = useState<string[]>([]);

  // Log parsing settings
  const [logJsonFields, setLogJsonFields] = useState("level, severity, log_level, loglevel, levelname");
  const [logLevelAliases, setLogLevelAliases] = useState("err=error, warning=warn, fatal=error, critical=error, panic=error");

  // Kubeconfig paths
  const [kubeconfigPaths, setKubeconfigPaths] = useState<string[]>([]);
  const [newKubeconfigPath, setNewKubeconfigPath] = useState("");

  // New Relic settings (per-context)
  const [nrContext, setNrContext] = useState("");
  const [newrelicApiKey, setNewrelicApiKey] = useState("");
  const [newrelicAccountId, setNewrelicAccountId] = useState("");
  const [newrelicClusterName, setNewrelicClusterName] = useState("");

  // Helm chart paths
  const [helmContext, setHelmContext] = useState("");
  const [helmChartPaths, setHelmChartPaths] = useState<{ release: string; path: string; values: string }[]>([]);
  const [newHelmRelease, setNewHelmRelease] = useState("");
  const [newHelmPath, setNewHelmPath] = useState("");
  const [newHelmValues, setNewHelmValues] = useState("");

  const loadNrConfig = useCallback(async (ctx: string) => {
    if (!ctx) {
      setNewrelicApiKey("");
      setNewrelicAccountId("");
      setNewrelicClusterName("");
      return;
    }
    try {
      const [key, id, cluster] = await Promise.all([
        getConfig(`newrelic_api_key:${ctx}`),
        getConfig(`newrelic_account_id:${ctx}`),
        getConfig(`newrelic_cluster_name:${ctx}`),
      ]);
      setNewrelicApiKey(key || "");
      setNewrelicAccountId(id || "");
      setNewrelicClusterName(cluster || "");
    } catch {
      setNewrelicApiKey("");
      setNewrelicAccountId("");
      setNewrelicClusterName("");
    }
  }, []);

  const loadHelmPaths = useCallback(async (ctx: string) => {
    if (!ctx) {
      setHelmChartPaths([]);
      return;
    }
    try {
      const val = await getConfig(`helm_chart_paths:${ctx}`);
      if (val) {
        const parsed = JSON.parse(val) as Record<string, { path: string; values?: string[] }>;
        setHelmChartPaths(
          Object.entries(parsed).map(([release, cfg]) => ({
            release,
            path: cfg.path,
            values: (cfg.values || []).join(", "),
          })),
        );
      } else {
        setHelmChartPaths([]);
      }
    } catch {
      setHelmChartPaths([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, ctxs] = await Promise.all([getAllConfig(), getContexts()]);
      setContexts(ctxs);
      setDefaultContext(cfg["default_context"] || "");
      setDefaultNamespace(cfg["default_namespace"] || "");
      setTerminalShellPath(cfg["terminal_shell_path"] || "/bin/sh");
      setTerminalFontSize(cfg["terminal_font_size"] || "13");
      setTerminalFontFamily(
        cfg["terminal_font_family"] ||
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      );
      setClaudePermissionMode(cfg["claude_permission_mode"] || "text_only");
      try {
        const expanded = cfg["sidebar_default_expanded"]
          ? JSON.parse(cfg["sidebar_default_expanded"])
          : [];
        setDefaultExpanded(Array.isArray(expanded) ? expanded : []);
      } catch {
        setDefaultExpanded([]);
      }
      try {
        const paths = cfg["kubeconfig_paths"]
          ? JSON.parse(cfg["kubeconfig_paths"])
          : [];
        setKubeconfigPaths(Array.isArray(paths) ? paths : []);
      } catch {
        setKubeconfigPaths([]);
      }
      // Log parsing settings
      try {
        const fields = cfg["log_parser_json_fields"]
          ? JSON.parse(cfg["log_parser_json_fields"])
          : null;
        if (Array.isArray(fields)) {
          setLogJsonFields(fields.join(", "));
        }
      } catch { /* keep default */ }
      try {
        const mapping = cfg["log_parser_level_mapping"]
          ? JSON.parse(cfg["log_parser_level_mapping"])
          : null;
        if (mapping && typeof mapping === "object" && !Array.isArray(mapping)) {
          setLogLevelAliases(
            Object.entries(mapping as Record<string, string>)
              .map(([k, v]) => `${k}=${v}`)
              .join(", "),
          );
        }
      } catch { /* keep default */ }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Default context/namespace
      if (defaultContext) {
        await setConfig("default_context", defaultContext);
      } else {
        await deleteConfig("default_context");
      }
      if (defaultNamespace) {
        await setConfig("default_namespace", defaultNamespace);
      } else {
        await deleteConfig("default_namespace");
      }

      // Claude integration
      await setConfig("claude_permission_mode", claudePermissionMode);

      // Terminal settings
      await setConfig("terminal_shell_path", terminalShellPath || "/bin/sh");
      await setConfig("terminal_font_size", terminalFontSize || "13");
      await setConfig(
        "terminal_font_family",
        terminalFontFamily ||
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      );

      // Sidebar default expanded categories
      if (defaultExpanded.length > 0) {
        await setConfig("sidebar_default_expanded", JSON.stringify(defaultExpanded));
      } else {
        await deleteConfig("sidebar_default_expanded");
      }

      // Kubeconfig paths
      if (kubeconfigPaths.length > 0) {
        await setConfig("kubeconfig_paths", JSON.stringify(kubeconfigPaths));
      } else {
        await deleteConfig("kubeconfig_paths");
      }

      // Log parsing settings
      const parsedFields = logJsonFields
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parsedFields.length > 0) {
        await setConfig("log_parser_json_fields", JSON.stringify(parsedFields));
      } else {
        await deleteConfig("log_parser_json_fields");
      }

      const aliasEntries = logLevelAliases
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((pair) => {
          const [key, ...rest] = pair.split("=");
          return [key?.trim(), rest.join("=").trim()] as const;
        })
        .filter(([k, v]) => k && v);
      if (aliasEntries.length > 0) {
        await setConfig(
          "log_parser_level_mapping",
          JSON.stringify(Object.fromEntries(aliasEntries)),
        );
      } else {
        await deleteConfig("log_parser_level_mapping");
      }

      // New Relic settings — save for the currently selected NR context
      if (nrContext) {
        if (newrelicApiKey) {
          await setConfig(`newrelic_api_key:${nrContext}`, newrelicApiKey);
        } else {
          await deleteConfig(`newrelic_api_key:${nrContext}`);
        }
        if (newrelicAccountId) {
          await setConfig(`newrelic_account_id:${nrContext}`, newrelicAccountId);
        } else {
          await deleteConfig(`newrelic_account_id:${nrContext}`);
        }
        if (newrelicClusterName) {
          await setConfig(`newrelic_cluster_name:${nrContext}`, newrelicClusterName);
        } else {
          await deleteConfig(`newrelic_cluster_name:${nrContext}`);
        }
      }

      // Helm chart paths — save for the currently selected helm context
      if (helmContext) {
        const validEntries = helmChartPaths.filter((e) => e.release && e.path);
        if (validEntries.length > 0) {
          const obj: Record<string, { path: string; values: string[] }> = {};
          for (const entry of validEntries) {
            const valuesList = entry.values
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            obj[entry.release] = { path: entry.path, values: valuesList };
          }
          await setConfig(`helm_chart_paths:${helmContext}`, JSON.stringify(obj));
        } else {
          await deleteConfig(`helm_chart_paths:${helmContext}`);
        }
      }

      onOpenChange(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleClearDefaults = async () => {
    setSaving(true);
    try {
      await deleteConfig("default_context");
      await deleteConfig("default_namespace");
      setDefaultContext("");
      setDefaultNamespace("");
    } finally {
      setSaving(false);
    }
  };

  const addKubeconfigPath = () => {
    const trimmed = newKubeconfigPath.trim();
    if (trimmed && !kubeconfigPaths.includes(trimmed)) {
      setKubeconfigPaths([...kubeconfigPaths, trimmed]);
      setNewKubeconfigPath("");
    }
  };

  const removeKubeconfigPath = (index: number) => {
    setKubeconfigPaths(kubeconfigPaths.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure cluster, terminal, and other preferences
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cluster Defaults */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Cluster Defaults</h3>

              <div className="space-y-2">
                <label className="text-sm font-medium">Default Context</label>
                <Select value={defaultContext} onValueChange={setDefaultContext}>
                  <SelectTrigger>
                    <SelectValue placeholder="None (manual selection)" />
                  </SelectTrigger>
                  <SelectContent>
                    {contexts.map((ctx) => (
                      <SelectItem key={ctx.name} value={ctx.name}>
                        {ctx.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Automatically connect to this context on startup
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Default Namespace</label>
                <Input
                  value={defaultNamespace}
                  onChange={(e) => setDefaultNamespace(e.target.value)}
                  placeholder="e.g. default"
                />
                <p className="text-xs text-muted-foreground">
                  Automatically select this namespace on startup
                </p>
              </div>
            </section>

            {/* Terminal Settings */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Terminal</h3>

              <div className="space-y-2">
                <label className="text-sm font-medium">Shell Path</label>
                <Input
                  value={terminalShellPath}
                  onChange={(e) => setTerminalShellPath(e.target.value)}
                  placeholder="/bin/sh"
                />
                <p className="text-xs text-muted-foreground">
                  Shell to use when exec-ing into pods (e.g. /bin/sh, /bin/bash)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Font Size</label>
                <Input
                  type="number"
                  min={8}
                  max={32}
                  value={terminalFontSize}
                  onChange={(e) => setTerminalFontSize(e.target.value)}
                  placeholder="13"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Font Family</label>
                <Input
                  value={terminalFontFamily}
                  onChange={(e) => setTerminalFontFamily(e.target.value)}
                  placeholder="monospace"
                />
              </div>
            </section>

            {/* Claude Integration */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Claude Integration</h3>
              <p className="text-xs text-muted-foreground">
                Configure what Claude can do when using "Ask Claude" on resources.
                Requires <a href="https://docs.anthropic.com/en/docs/claude-code/overview" target="_blank" rel="noopener noreferrer" className="underline">Claude Code CLI</a> installed.
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium">Permission Mode</label>
                <Select value={claudePermissionMode} onValueChange={setClaudePermissionMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text_only">Text only (no tools)</SelectItem>
                    <SelectItem value="allow_bash">Allow kubectl & helm</SelectItem>
                    <SelectItem value="bypass_all">Bypass all permissions</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {claudePermissionMode === "text_only" && "Claude answers only from the pre-loaded resource context. No commands are executed."}
                  {claudePermissionMode === "allow_bash" && "Claude can run kubectl and helm commands to gather additional information from the cluster."}
                  {claudePermissionMode === "bypass_all" && "Claude has unrestricted access to all tools (file read/write, bash, etc). Use with caution."}
                </p>
              </div>
            </section>

            {/* Log Parsing */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Log Parsing</h3>

              <div className="space-y-2">
                <label className="text-sm font-medium">JSON Level Fields</label>
                <Input
                  value={logJsonFields}
                  onChange={(e) => setLogJsonFields(e.target.value)}
                  placeholder="level, severity, log_level, loglevel, levelname"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated JSON field names to check for log level
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Level Aliases</label>
                <Input
                  value={logLevelAliases}
                  onChange={(e) => setLogLevelAliases(e.target.value)}
                  placeholder="err=error, warning=warn, fatal=error"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated alias=level pairs for custom level mapping
                </p>
              </div>
            </section>

            {/* Helm Chart Paths */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Helm</h3>
              <p className="text-xs text-muted-foreground">
                Map Helm releases to local chart paths for diffing deployed vs local templates
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium">Context</label>
                <Select
                  value={helmContext}
                  onValueChange={(val) => {
                    setHelmContext(val);
                    loadHelmPaths(val);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a context" />
                  </SelectTrigger>
                  <SelectContent>
                    {contexts.map((ctx) => (
                      <SelectItem key={ctx.name} value={ctx.name}>
                        {ctx.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {helmContext && (
                <div className="space-y-3">
                  {helmChartPaths.map((entry, i) => (
                    <div key={i} className="space-y-1.5 rounded-md border border-border p-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={entry.release}
                          onChange={(e) => {
                            const updated = [...helmChartPaths];
                            updated[i] = { ...updated[i], release: e.target.value };
                            setHelmChartPaths(updated);
                          }}
                          placeholder="release-name"
                          className="flex-1 text-xs font-mono"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() =>
                            setHelmChartPaths(helmChartPaths.filter((_, j) => j !== i))
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input
                        value={entry.path}
                        onChange={(e) => {
                          const updated = [...helmChartPaths];
                          updated[i] = { ...updated[i], path: e.target.value };
                          setHelmChartPaths(updated);
                        }}
                        placeholder="Chart path: /path/to/chart"
                        className="text-xs font-mono"
                      />
                      <Input
                        value={entry.values}
                        onChange={(e) => {
                          const updated = [...helmChartPaths];
                          updated[i] = { ...updated[i], values: e.target.value };
                          setHelmChartPaths(updated);
                        }}
                        placeholder="Values files (comma-separated): /path/to/values.yaml, /path/to/values-dev.yaml"
                        className="text-xs font-mono"
                      />
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <Input
                      value={newHelmRelease}
                      onChange={(e) => setNewHelmRelease(e.target.value)}
                      placeholder="release-name"
                      className="flex-1 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const r = newHelmRelease.trim();
                          if (r) {
                            setHelmChartPaths([...helmChartPaths, { release: r, path: newHelmPath.trim(), values: newHelmValues.trim() }]);
                            setNewHelmRelease("");
                            setNewHelmPath("");
                            setNewHelmValues("");
                          }
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        const r = newHelmRelease.trim();
                        if (r) {
                          setHelmChartPaths([...helmChartPaths, { release: r, path: newHelmPath.trim(), values: newHelmValues.trim() }]);
                          setNewHelmRelease("");
                          setNewHelmPath("");
                          setNewHelmValues("");
                        }
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {/* New Relic */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">New Relic</h3>
              <p className="text-xs text-muted-foreground">
                Connect to New Relic for CPU/Memory metrics via NerdGraph API (per cluster)
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium">Context</label>
                <Select
                  value={nrContext}
                  onValueChange={(val) => {
                    setNrContext(val);
                    loadNrConfig(val);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a context" />
                  </SelectTrigger>
                  <SelectContent>
                    {contexts.map((ctx) => (
                      <SelectItem key={ctx.name} value={ctx.name}>
                        {ctx.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {nrContext && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">API Key</label>
                    <Input
                      type="password"
                      value={newrelicApiKey}
                      onChange={(e) => setNewrelicApiKey(e.target.value)}
                      placeholder="NRAK-..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Account ID</label>
                    <Input
                      value={newrelicAccountId}
                      onChange={(e) => setNewrelicAccountId(e.target.value)}
                      placeholder="e.g. 1234567"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cluster Name</label>
                    <Input
                      value={newrelicClusterName}
                      onChange={(e) => setNewrelicClusterName(e.target.value)}
                      placeholder="e.g. my-prod-cluster"
                    />
                    <p className="text-xs text-muted-foreground">
                      The cluster name as it appears in New Relic (clusterName attribute)
                    </p>
                  </div>
                </>
              )}
            </section>

            {/* Default Expanded Categories */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Sidebar</h3>
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Expanded Categories</label>
                <p className="text-xs text-muted-foreground">
                  Choose which sidebar categories start expanded on launch
                </p>
                <div className="space-y-1.5">
                  {ALL_SIDEBAR_CATEGORIES.map((cat) => (
                    <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={defaultExpanded.includes(cat)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDefaultExpanded([...defaultExpanded, cat]);
                          } else {
                            setDefaultExpanded(defaultExpanded.filter((c) => c !== cat));
                          }
                        }}
                        className="rounded border-border"
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* Kubeconfig Paths */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Kubeconfig Paths</h3>
              <p className="text-xs text-muted-foreground">
                Add extra kubeconfig files or directories to scan for contexts
              </p>

              {kubeconfigPaths.map((path, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={path}
                    readOnly
                    className="flex-1 text-xs font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeKubeconfigPath(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <Input
                  value={newKubeconfigPath}
                  onChange={(e) => setNewKubeconfigPath(e.target.value)}
                  placeholder="~/.kube/config or /path/to/dir"
                  className="flex-1 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKubeconfigPath();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={addKubeconfigPath}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </section>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearDefaults}
                disabled={saving}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Clear Defaults
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1 h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
