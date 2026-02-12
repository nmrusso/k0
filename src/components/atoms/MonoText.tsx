export function MonoText({
  size = "xs",
  children,
  className = "",
}: {
  size?: "xs" | "sm";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`${size === "xs" ? "mono-xs" : "mono-sm"} ${className}`}>
      {children}
    </span>
  );
}
