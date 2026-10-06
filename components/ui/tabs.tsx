"use client";

import type { ReactNode } from "react";

export function Tabs({ items, value, onChange }: { items: { value: string; label: string; content?: ReactNode }[]; value: string; onChange: (value: string) => void }) {
  const active = items.find((item) => item.value === value) ?? items[0];
  return (
    <div className="ui-tabs">
      <div aria-label="Sections" className="ui-tab-list" role="tablist">
        {items.map((item) => (
          <button aria-selected={item.value === active?.value} className={item.value === active?.value ? "ui-tab ui-tab-active" : "ui-tab"} key={item.value} role="tab" type="button" onClick={() => onChange(item.value)}>
            {item.label}
          </button>
        ))}
      </div>
      {active?.content ? <div className="ui-tab-panel" role="tabpanel">{active.content}</div> : null}
    </div>
  );
}
