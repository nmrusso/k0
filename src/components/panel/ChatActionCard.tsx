// @ts-nocheck
import { Button } from "@/components/ui/button";
import { Check, X, Loader2, AlertCircle } from "lucide-react";
import { useChatStore, type ActionRequest } from "@/stores/chatStore";
import { executeChatAction } from "@/lib/tauri-commands";

interface ChatActionCardProps {
  sessionId: string;
  action: ActionRequest;
}

export function ChatActionCard({ sessionId, action }: ChatActionCardProps) {
  const updateActionStatus = useChatStore((s) => s.updateActionStatus);

  const handleApprove = async () => {
    updateActionStatus(sessionId, action.actionId, "executing");
    try {
      const result = await executeChatAction(action.actionType, action.params);
      updateActionStatus(sessionId, action.actionId, "executed", result);
    } catch (e) {
      updateActionStatus(sessionId, action.actionId, "failed", String(e));
    }
  };

  const handleReject = () => {
    updateActionStatus(sessionId, action.actionId, "rejected");
  };

  const statusColors: Record<ActionRequest["status"], string> = {
    pending: "border-yellow-500/30 bg-yellow-500/5",
    executing: "border-blue-500/30 bg-blue-500/5",
    executed: "border-green-500/30 bg-green-500/5",
    failed: "border-red-500/30 bg-red-500/5",
    rejected: "border-muted bg-muted/20",
  };

  return (
    <div
      className={`rounded-md border p-3 text-sm ${statusColors[action.status]}`}
    >
      <div className="mb-2 font-medium">{action.description}</div>
      <div className="mb-2 rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
        {action.actionType}({JSON.stringify(action.params)})
      </div>

      {action.status === "pending" && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={handleApprove}
            className="h-7 gap-1 text-xs"
          >
            <Check className="h-3 w-3" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReject}
            className="h-7 gap-1 text-xs"
          >
            <X className="h-3 w-3" />
            Reject
          </Button>
        </div>
      )}

      {action.status === "executing" && (
        <div className="flex items-center gap-2 text-xs text-blue-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Executing...
        </div>
      )}

      {action.status === "executed" && (
        <div className="flex items-center gap-2 text-xs text-green-500">
          <Check className="h-3 w-3" />
          {action.result ?? "Executed successfully"}
        </div>
      )}

      {action.status === "failed" && (
        <div className="flex items-center gap-2 text-xs text-red-500">
          <AlertCircle className="h-3 w-3" />
          {action.result ?? "Action failed"}
        </div>
      )}

      {action.status === "rejected" && (
        <div className="text-xs text-muted-foreground">
          Action rejected
        </div>
      )}
    </div>
  );
}
