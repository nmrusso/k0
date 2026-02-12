export function ResourceCard({
  onClick,
  children,
  className = "",
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div onClick={onClick} className={`card-interactive ${className}`}>
      {children}
    </div>
  );
}
