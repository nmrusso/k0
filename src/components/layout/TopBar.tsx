import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useContexts } from "@/hooks/useContexts";
import { useNamespaces } from "@/hooks/useNamespaces";
import { useClusterStore } from "@/stores/clusterStore";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { Server, Layers, Settings } from "lucide-react";

export function TopBar() {
  const { contexts, loading: ctxLoading } = useContexts();
  const { namespaces, loading: nsLoading, selectNamespace } = useNamespaces();
  const activeContext = useClusterStore((s) => s.activeContext);
  const activeNamespace = useClusterStore((s) => s.activeNamespace);
  const { selectContext } = useContexts();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-12 items-center gap-3 border-b border-border bg-card px-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <span className="text-lg">k0</span>
      </div>

      <div className="mx-2 h-6 w-px bg-border" />

      <div className="flex items-center gap-2">
        <Server className="h-4 w-4 text-muted-foreground" />
        <Select
          value={activeContext ?? ""}
          onValueChange={selectContext}
          disabled={ctxLoading}
        >
          <SelectTrigger className="h-8 w-[220px] border-border bg-background text-sm">
            <SelectValue placeholder="Select cluster..." />
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

      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <Select
          value={activeNamespace ?? ""}
          onValueChange={selectNamespace}
          disabled={!activeContext || nsLoading}
        >
          <SelectTrigger className="h-8 w-[200px] border-border bg-background text-sm">
            <SelectValue placeholder="Select namespace..." />
          </SelectTrigger>
          <SelectContent>
            {namespaces.map((ns) => (
              <SelectItem key={ns.name} value={ns.name}>
                {ns.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {activeContext && (
          <span className="text-xs text-muted-foreground">
            {activeContext}
            {activeNamespace && ` / ${activeNamespace}`}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
