"use client";

import { useActionState } from "react";
import type { ConfigActionState } from "@/app/configuration/actions";

type Action = (state: ConfigActionState, formData: FormData) => Promise<ConfigActionState>;

export type ConfigField = {
  name: string;
  label: string;
  type?: "text" | "date" | "select" | "checkbox";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

export function ConfigurationManager({
  title,
  description,
  action,
  toggleAction,
  fields,
  rows,
  emptyText,
  editLabel = "Edit",
}: {
  title: string;
  description: string;
  action: Action;
  toggleAction?: Action;
  fields: ConfigField[];
  rows: Record<string, unknown>[];
  emptyText: string;
  editLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const initial = rows[0];

  return (
    <div className="config-manager">
      <section className="panel config-form-panel">
        <div className="panel-heading">
          <div><h2>{title}</h2><p>{description}</p></div>
        </div>
        <form className="erp-form" action={formAction}>
          <input type="hidden" name="id" value={String(initial?.id ?? "")} />
          <div className="form-grid">
            {fields.map((field) => (
              <label key={field.name} className={field.type === "checkbox" ? "checkbox-field" : ""}>
                <span>{field.label}</span>
                {field.type === "select" ? (
                  <select name={field.name} defaultValue={String(initial?.[field.name] ?? "")} required={field.required}>
                    <option value="">Select...</option>
                    {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : field.type === "checkbox" ? (
                  <input type="checkbox" name={field.name} value="true" defaultChecked={initial?.[field.name] !== false} />
                ) : (
                  <input type={field.type ?? "text"} name={field.name} defaultValue={String(initial?.[field.name] ?? "")} placeholder={field.placeholder} required={field.required} />
                )}
              </label>
            ))}
          </div>
          {state.error && <p className="form-error">{state.error}</p>}
          {state.success && <p className="form-success">{state.success}</p>}
          <div className="form-actions"><button className="primary-button" disabled={pending}>{pending ? "Saving..." : initial ? editLabel : "Create"}</button></div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Records</h2><p>{rows.length} record{rows.length === 1 ? "" : "s"} in the current organization.</p></div>
        </div>
        <div className="data-table-scroll">
          {rows.length ? (
            <table className="data-table">
              <thead><tr>{fields.filter((f) => f.type !== "checkbox").map((f) => <th key={f.name}>{f.label}</th>)}<th>Status</th>{toggleAction && <th>Action</th>}</tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.id)}>
                    {fields.filter((f) => f.type !== "checkbox").map((f) => <td key={f.name}>{String(row[f.name] ?? "—")}</td>)}
                    <td><span className={row.is_active === true || row.status === "open" ? "status-pill active" : "status-pill"}>{row.status ? String(row.status) : row.is_active ? "Active" : "Inactive"}</span></td>
                    {toggleAction && <td className="row-actions"><form action={toggleAction}><input type="hidden" name="id" value={String(row.id)} /><input type="hidden" name={row.status ? "next_open" : "next_active"} value={row.status ? String(row.status !== "open") : String(row.is_active !== true)} /><button className="text-button">{row.status ? (row.status === "open" ? "Close" : "Open") : (row.is_active ? "Deactivate" : "Activate")}</button></form></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty-state">{emptyText}</div>}
        </div>
      </section>
    </div>
  );
}
