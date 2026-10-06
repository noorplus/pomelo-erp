"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ui-overlay" role="presentation" onMouseDown={onClose}>
      <section aria-modal="true" aria-labelledby="ui-modal-title" className="ui-dialog" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <header className="ui-dialog-header">
          <h2 id="ui-modal-title">{title}</h2>
          <button aria-label="Close dialog" className="navigation-close" type="button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="ui-dialog-body">{children}</div>
      </section>
    </div>
  );
}
