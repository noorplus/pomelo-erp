import type { ReactNode } from "react";

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="ui-form-actions">{children}</div>;
}
