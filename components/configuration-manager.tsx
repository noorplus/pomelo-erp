"use client";

import Link from "next/link";
import { useActionState } from "react";
import { DataTable, DataTableEmpty } from "@/components/data-table";
import type { ConfigActionState } from "@/app/configuration/actions";

type Action = (state: ConfigActionState, formData: FormData) => Promise<ConfigActionState>;
type RowRule = { field: string; values: Array<string | number | boolean | null> };

export type ConfigField = {
  name: string;
  label: string;
  type?: "text" | "date" | "number" | "select" | "checkbox";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  readOnly?: boolean;
  displayKey?: string;
};

function matchesRule(row: Record<string, unknown>, rule?: RowRule) {
  if (!rule) return false;
  return rule.values.some(value => row[rule.field] === value);
}

export function ConfigurationManager({
  title, description, action, toggleAction, fields, rows, editingRow, editHref, newHref,
  emptyText, readOnly = false, canCreate = true, editDisabledBy, toggleDisabledBy, hideToggleBy,
}: {
  title: string;
  description: string;
  action?: (formData: FormData) => Promise<ConfigActionState>;
  toggleAction?: (formData: FormData) => Promise<ConfigActionState>;
  fields: ConfigField[];
  rows: Record<string, unknown>[];
  editingRow?: Record<string, unknown>;
  editHref: string;
  newHref: string;
  emptyText: string;
  readOnly?: boolean;
  canCreate?: boolean;
  editDisabledBy?: RowRule;
  toggleDisabledBy?: RowRule;
  hideToggleBy?: RowRule;
}) {
  const saveAdapter: Action = async (_state, formData) => action ? action(formData) : {};
  const toggleAdapter: Action = async (_state, formData) => toggleAction ? toggleAction(formData) : {};
  const [state, formAction, pending] = useActionState(saveAdapter, {});
  const [toggleState, toggleFormAction, togglePending] = useActionState(toggleAdapter, {});
  const editingLocked = !!editingRow && matchesRule(editingRow, editDisabledBy);
  const displayFields = fields.filter(field => field.type !== "checkbox");

  return (
    <div className="config-manager">
      {!readOnly && action && !editingLocked && (
        <section className="panel config-form-panel">
          <div className="panel-heading">
            <div><h2>{editingRow ? "Edit" : "Add"} {title}</h2><p>{description}</p></div>
            {editingRow && canCreate && <Link className="secondary-button compact" href={newHref}>New</Link>}
          </div>
          <form className="erp-form" action={formAction}>
            <input type="hidden" name="id" value={String(editingRow?.id ?? "")} />
            <div className="form-grid">
              {fields.map(field => {
                const current = String(editingRow?.[field.name] ?? "");
                const checked = editingRow ? editingRow[field.name] === true : true;
                return (
                  <label key={field.name} className={field.type === "checkbox" ? "checkbox-field" : ""}>
                    <span>{field.label}</span>
                    {field.type === "select" ? (
                      <>
                        {field.readOnly && <input type="hidden" name={field.name} value={current} />}
                        <select name={field.readOnly ? undefined : field.name} defaultValue={current} required={field.required} disabled={field.readOnly}>
                          <option value="">Select...</option>
                          {field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </>
                    ) : field.type === "checkbox" ? (
                      <>
                        {field.readOnly && <input type="hidden" name={field.name} value={checked ? "true" : "false"} />}
                        <input type="checkbox" name={field.readOnly ? undefined : field.name} value="true" defaultChecked={checked} disabled={field.readOnly} />
                      </>
                    ) : (
                      <>
                        {field.readOnly && <input type="hidden" name={field.name} value={current} />}
                        <input type={field.type ?? "text"} name={field.readOnly ? undefined : field.name} defaultValue={current} placeholder={field.placeholder} required={field.required} readOnly={field.readOnly} />
                      </>
                    )}
                  </label>
                );
              })}
            </div>
            {state.error && <p className="form-message error" role="alert">{state.error}</p>}
            {state.success && <p className="form-message success" role="status">{state.success}</p>}
            <div className="form-actions"><button className="primary-button" disabled={pending}>{pending ? "Saving..." : editingRow ? "Save changes" : "Create"}</button></div>
          </form>
        </section>
      )}
      {editingLocked && (
        <section className="panel">
          <div className="panel-heading">
            <div><h2>Read-only record</h2><p>{description}</p></div>
            <Link className="secondary-button compact" href={editHref}>Back</Link>
          </div>
          <p className="form-message">This record is protected by the current ERP lifecycle rules and cannot be edited.</p>
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div><h2>{readOnly ? "Current configuration" : "Records"}</h2><p>{rows.length} record{rows.length === 1 ? "" : "s"} in the current organization.</p></div>
          {!readOnly && action && canCreate && <Link className="primary-button compact" href={newHref}>Add {title}</Link>}
        </div>
        {rows.length ? (
          <DataTable minWidth={Math.max(640, displayFields.length * 140 + 160)}>
            <thead><tr>{displayFields.map(f => <th key={f.name}>{f.label}</th>)}<th>Status</th>{!readOnly && <th>Action</th>}</tr></thead>
            <tbody>{rows.map(row => {
              const editLocked = matchesRule(row, editDisabledBy);
              const toggleLocked = matchesRule(row, toggleDisabledBy);
              const toggleHidden = matchesRule(row, hideToggleBy);
              return <tr key={String(row.id)}>
                {displayFields.map(f => <td key={f.name}>{String(row[f.displayKey ?? f.name] ?? "—")}</td>)}
                <td><span className={row.status === "open" || row.is_active === true ? "status-pill active" : "status-pill"}>{row.status ? String(row.status) : row.is_active ? "Active" : "Inactive"}</span></td>
                {!readOnly && <td className="row-actions">
                  {editLocked ? <span className="text-muted">View only</span> : <Link className="text-button" href={editHref + "?edit=" + String(row.id)}>Edit</Link>}
                  {toggleAction && !toggleHidden && (toggleLocked ? <span className="text-muted">Protected</span> : <form className="inline-form" action={toggleFormAction}>
                    <input type="hidden" name="id" value={String(row.id)} />
                    <input type="hidden" name={row.status ? "next_open" : "next_active"} value={row.status ? String(row.status === "open" ? false : true) : String(row.is_active !== true)} />
                    <button className="text-button" disabled={togglePending}>{row.status ? (row.status === "open" ? "Close" : "Open") : (row.is_active ? "Deactivate" : "Activate")}</button>
                  </form>)}
                </td>}
              </tr>;
            })}</tbody>
          </DataTable>
        ) : <DataTableEmpty title="No records" description={emptyText} />}
        {toggleState.error && <p className="form-message error config-feedback" role="alert">{toggleState.error}</p>}
        {toggleState.success && <p className="form-message success config-feedback" role="status">{toggleState.success}</p>}
      </section>
    </div>
  );
}
