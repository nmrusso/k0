export function SectionHeader({
  children,
  as: Tag = "h3",
}: {
  children: React.ReactNode;
  as?: "h3" | "h4";
}) {
  return <Tag className="section-header">{children}</Tag>;
}
