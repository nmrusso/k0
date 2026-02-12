import { useState, useEffect, useRef } from "react";
import type { RolloutTimeline, ReplicaSetSnapshot } from "@/types/k8s";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronRight,
  Rocket,
  ImageIcon,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface RolloutReplayProps {
  timeline: RolloutTimeline | null;
  loading: boolean;
}

export function RolloutReplay({ timeline, loading }: RolloutReplayProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // Auto-scroll to bottom (most recent) on load
  useEffect(() => {
    if (timeline && !loading) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [timeline, loading]);

  const toggleStep = (idx: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground p-4">
        <p className="text-sm">Failed to load rollout timeline</p>
      </div>
    );
  }

  if (timeline.steps.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Rocket className="h-4 w-4 text-blue-400" />
          Rollout: {timeline.deployment_name}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <CheckCircle className="mb-2 h-8 w-8 text-green-400/50" />
          <p className="text-sm">No rollout history found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto h-full">
      <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
        <Rocket className="h-4 w-4 text-blue-400" />
        Rollout: {timeline.deployment_name}
      </h3>

      {/* Timeline */}
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

        {timeline.steps.map((step, i) => {
          const isExpanded = expandedSteps.has(i);
          const isLast = i === timeline.steps.length - 1;

          return (
            <div key={i} className="relative mb-4">
              {/* Dot */}
              <div
                className={`absolute -left-6 top-1 h-[10px] w-[10px] rounded-full border-2 ${
                  isLast
                    ? "border-blue-400 bg-blue-400"
                    : "border-border bg-background"
                }`}
              />

              <div
                className="rounded-md border border-border/50 bg-card p-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleStep(i)}
              >
                {/* Step header */}
                <div className="flex items-center gap-2">
                  <StepIcon stepType={step.step_type} />
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {step.step_type}
                  </Badge>
                  {step.timestamp && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatTimestamp(step.timestamp)}
                    </span>
                  )}
                  {step.events.length > 0 && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </span>
                  )}
                </div>

                {/* Step description */}
                <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>

                {/* RS Snapshots side by side */}
                {(step.old_rs || step.new_rs) && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {step.old_rs && (
                      <RSSnapshot label="Old" snapshot={step.old_rs} />
                    )}
                    {step.new_rs && (
                      <RSSnapshot label="New" snapshot={step.new_rs} isNew />
                    )}
                  </div>
                )}

                {/* Expanded events */}
                {isExpanded && step.events.length > 0 && (
                  <div className="mt-2 border-t border-border/50 pt-2 space-y-1">
                    {step.events.map((ev, j) => (
                      <div key={j} className="text-xs">
                        <Badge
                          variant={ev.event_type === "Warning" ? "destructive" : "secondary"}
                          className="text-[9px] mr-1.5"
                        >
                          {ev.reason}
                        </Badge>
                        <span className="text-muted-foreground">{ev.message}</span>
                        {ev.age && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground/50">{ev.age}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function RSSnapshot({
  label,
  snapshot,
  isNew,
}: {
  label: string;
  snapshot: ReplicaSetSnapshot;
  isNew?: boolean;
}) {
  return (
    <div className={`rounded border p-1.5 text-[10px] ${
      isNew ? "border-blue-400/30 bg-blue-400/5" : "border-border/50 bg-muted/30"
    }`}>
      <div className="font-medium text-muted-foreground mb-0.5">{label} RS</div>
      <div className="font-mono truncate">{snapshot.name}</div>
      <div className="text-muted-foreground">rev: {snapshot.revision}</div>
      <div className="text-muted-foreground">
        replicas: {snapshot.ready}/{snapshot.replicas}
      </div>
      <div className="font-mono truncate text-muted-foreground/70">{snapshot.image}</div>
    </div>
  );
}

function StepIcon({ stepType }: { stepType: string }) {
  if (stepType.startsWith("revision:")) {
    return <ImageIcon className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
  }
  if (stepType.includes("ScalingReplicaSet")) {
    return <Activity className="h-3.5 w-3.5 text-green-400 shrink-0" />;
  }
  if (stepType.includes("Warning") || stepType.includes("BackOff")) {
    return <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />;
  }
  return <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return ts;
  }
}
