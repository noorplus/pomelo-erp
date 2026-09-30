"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveUnit, type UnitActionState } from "./actions";

type Unit = { id: string; code: string; name: string; symbol: string | null };

export function UnitForm({ unit }: { unit?: Unit | null }) {
  const [state, formAction, pending] = useActionState(saveUnit, {});

  return (
    <form action={formAction} className="erp-form">
      {unit?.id ? <input type="hidden" name="id" value={unit.id} /> : null}
      <div className="form-header">
        <div>
          <p className="eyebrow">{unit ? "Edit unit" : "New unit"}</p>
          <h2>{unit ? unit.name : "Create unit"}</h2>
        </div>
        {unit ? <Link href="/settings/units" className="secondary-button compact">Cancel</Link> : null}
      </div>
      <div className="form-grid">
        <label>
          Unit code
          <input name="code" defaultValue={unit?.code ?? ""} maxLength={30} placeholder="e.g. PCS" required />
          <span className="field-help">Unique within this organization. Stored uppercase.</span>
        </label>
        <label>
          Unit name
          <input name="name" defaultValue={unit?.name ?? ""} maxLength={100} placeholder="e.g. Pieces" required />
        </label>
        <label>
          Symbol
          <input name="symbol" defaultValue={unit?.symbol ?? ""} maxLength={20} placeholder="e.g. pcs" />
        </label>
      </div>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.success ? <p className="form-success">{state.success}</p> : null}
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving…" : unit ? "Save changes" : "Create unit"}</button>
      </div>
    </form>
  );
}
