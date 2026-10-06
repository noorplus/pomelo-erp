import type { ReactNode } from "react";

export function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ui-filter">
      <span>{label}</span>
      {children}
    </label>
  );
}
