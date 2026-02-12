export function DetailRow({
  label,
  children,
  labelWidth = "w-40",
}: {
  label: string;
  children: React.ReactNode;
  labelWidth?: string;
}) {
  return (
    <div className="detail-row">
      <div className={`${labelWidth} shrink-0 text-muted-sm`}>
        {label}
      </div>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  );
}
