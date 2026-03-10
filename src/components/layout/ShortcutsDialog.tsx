import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutRow {
  keys: string[];   // each string is one key combo or chord, e.g. "Cmd+k", "g p"
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutRow[];
}

const SYMBOL: Record<string, string> = {
  Cmd: "⌘",
  Shift: "⇧",
  Alt: "⌥",
  Escape: "Esc",
  Enter: "↵",
};

/** Render one key label, e.g. "Cmd+Shift+k" or "g p" (chord) */
function KeyLabel({ combo }: { combo: string }) {
  // Chord: "g p" — split on space, show each part as a key with an arrow between
  if (combo.includes(" ")) {
    const parts = combo.split(" ");
    return (
      <span className="flex items-center gap-0.5">
        {parts.map((part, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <span className="text-muted-foreground/40 text-[10px]">then</span>}
            <Key k={part} />
          </span>
        ))}
      </span>
    );
  }
  // Modifier combo: split on "+"
  const parts = combo.split("+");
  return (
    <span className="flex items-center gap-0.5">
      {parts.map((p, i) => <Key key={i} k={p} />)}
    </span>
  );
}

function Key({ k }: { k: string }) {
  return (
    <kbd className="inline-flex min-w-[1.4rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none text-foreground shadow-sm">
      {SYMBOL[k] ?? k}
    </kbd>
  );
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "General",
    shortcuts: [
      { keys: ["Cmd+k", "Ctrl+k"], description: "Command palette" },
      { keys: ["?"], description: "Show this shortcuts guide" },
      { keys: ["Escape"], description: "Close sheet / dialog" },
      { keys: ["r"], description: "Refresh current view" },
      { keys: ["/"], description: "Focus search / filter bar" },
    ],
  },
  {
    title: "Tabs",
    shortcuts: [
      { keys: ["Cmd+w", "Ctrl+w"], description: "Close current tab" },
      { keys: ["Cmd+1 … 9", "Ctrl+1 … 9"], description: "Switch to tab by position" },
    ],
  },
  {
    title: "Panel",
    shortcuts: [
      { keys: ["Cmd+j", "Ctrl+j"], description: "Toggle bottom panel" },
      { keys: ["Cmd+t", "Ctrl+t"], description: "New terminal" },
      { keys: ["Cmd+Shift+a", "Ctrl+Shift+a"], description: "Open Activity log" },
    ],
  },
  {
    title: "Navigate — g + key",
    shortcuts: [
      { keys: ["g p"], description: "Pods" },
      { keys: ["g d"], description: "Deployments" },
      { keys: ["g s"], description: "Services" },
      { keys: ["g i"], description: "Ingresses" },
      { keys: ["g n"], description: "Network overview" },
      { keys: ["g c"], description: "ConfigMaps" },
      { keys: ["g e"], description: "Events" },
      { keys: ["g h"], description: "Helm Releases" },
    ],
  },
  {
    title: "Table",
    shortcuts: [
      { keys: ["j"], description: "Focus next row" },
      { keys: ["k"], description: "Focus previous row" },
      { keys: ["Enter"], description: "Open detail panel" },
      { keys: ["Escape"], description: "Deselect row" },
      { keys: ["l"], description: "Open logs (pods only)" },
    ],
  },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="mt-2 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((row) => (
                  <div key={row.description} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-foreground/80">{row.description}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {row.keys.map((combo, i) => (
                        <span key={combo} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-[10px] text-muted-foreground">/</span>
                          )}
                          <KeyLabel combo={combo} />
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Plain keys (j, k, r, /, ?) are ignored when focus is inside an input, terminal, or editor.
        </p>
      </DialogContent>
    </Dialog>
  );
}
