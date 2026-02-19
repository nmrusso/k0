import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle } from "lucide-react";
import { useChatDrawerStore } from "@/stores/chatDrawerStore";
import { checkClaudeCli } from "@/lib/tauri-commands";

interface AskClaudeButtonProps {
  gatherContext: () => Promise<string>;
  resourceKind: string;
  resourceName: string;
}

export function AskClaudeButton({
  gatherContext,
  resourceKind,
  resourceName,
}: AskClaudeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [cliAvailable, setCliAvailable] = useState<boolean | null>(null);
  const openDrawer = useChatDrawerStore((s) => s.openDrawer);

  useEffect(() => {
    checkClaudeCli()
      .then(setCliAvailable)
      .catch(() => setCliAvailable(null));
  }, []);

  const handleClick = async () => {
    setLoading(true);
    try {
      const context = await gatherContext();
      openDrawer({ resourceKind, resourceName, resourceContext: context });
    } catch (err) {
      openDrawer({
        resourceKind,
        resourceName,
        resourceContext: `Failed to gather full context: ${err}\n\nResource: ${resourceKind}/${resourceName}`,
      });
    } finally {
      setLoading(false);
    }
  };

  if (cliAvailable === false) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        title="Claude CLI not installed. Install it with: npm install -g @anthropic-ai/claude-code"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Ask Claude
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <MessageCircle className="h-3.5 w-3.5" />
      )}
      Ask Claude
    </Button>
  );
}
