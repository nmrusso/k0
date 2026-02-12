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

  // Helm chart paths
  const [helmContext, setHelmContext] = useState("");
  const [helmChartPaths, setHelmChartPaths] = useState<{ release: string; path: string; values: string }[]>([]);
  const [newHelmRelease, setNewHelmRelease] = useState("");
  const [newHelmPath, setNewHelmPath] = useState("");
  const [newHelmValues, setNewHelmValues] = useState("");

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
