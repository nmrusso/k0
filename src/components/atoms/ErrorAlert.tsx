import { AlertCircle } from "lucide-react";
import React from 'react';

export function ErrorAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="error-alert">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {children}
    </div>
  );
}
