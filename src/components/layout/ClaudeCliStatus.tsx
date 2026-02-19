import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { checkClaudeCli } from "@/lib/tauri-commands";

type CliState = "checking" | "available" | "not_found";

export function ClaudeCliStatus() {
  const [state, setState] = useState<CliState>("checking");

  useEffect(() => {
    checkClaudeCli()
      .then((ok) => setState(ok ? "available" : "not_found"))
      .catch(() => setState("not_found"));
  }, []);

  if (state === "checking") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Checking Claude CLI...">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Claude</span>
      </div>
    );
  }

  if (state === "not_found") {
    return (
      <a
        href="https://docs.anthropic.com/en/docs/claude-code/overview"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        title="Claude CLI not found — click to install"
      >
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span>Claude CLI</span>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Claude CLI detected">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      <span>Claude</span>
    </div>
  );
}
