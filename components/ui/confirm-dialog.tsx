import type { ReactNode } from "react";
import { Modal } from "./modal";

export function ConfirmDialog({ open, title, description, confirmLabel = "Confirm", onConfirm, onClose, children }: {
  open: boolean; title: string; description?: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void; children?: ReactNode;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      {description ? <p className="lede">{description}</p> : null}
      {children}
      <div className="ui-form-actions">
        <button className="button" type="button" onClick={onClose}>Cancel</button>
        <button className="button primary" type="button" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
