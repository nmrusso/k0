import React from 'react';

export function IconButton({
  onClick,
  children,
  title,
  variant = "default",
  className = "",
}: {
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  title?: string;
  variant?: "default" | "destructive";
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`${variant === "destructive" ? "icon-btn-destructive" : "icon-btn"} ${className}`}
    >
      {children}
    </button>
  );
}
