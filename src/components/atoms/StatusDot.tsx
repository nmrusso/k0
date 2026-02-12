const colorMap = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
  primary: "bg-primary",
} as const;

export function StatusDot({
  color,
  className = "",
}: {
  color: "success" | "warning" | "destructive" | "muted" | "primary";
  className?: string;
}) {
  return (
    <div
      className={`status-dot ${colorMap[color]} ${className}`}
    />
  );
}
