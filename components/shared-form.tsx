"use client";

import { FormEvent, ReactNode } from "react";

export type SharedFormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "date" | "select" | "textarea" | "checkbox";
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: Array<{ value: string; label: string }>;
  help?: string;
  colSpan?: 1 | 2 | 3;
};

type SharedFormProps = {
  fields: SharedFormField[];
  values: Record<string, string | number | boolean>;
  onChange: (name: string, value: string | number | boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  submitting?: boolean;
  error?: string | null;
  success?: string | null;
  children?: ReactNode;
};

export function SharedForm({
  fields,
  values,
  onChange,
  onSubmit,
  submitLabel = "Save",
  submitting = false,
  error,
  success,
  children,
}: SharedFormProps) {
  return (
    <form className="shared-form" onSubmit={onSubmit}>
      <div className="shared-form-grid">
        {fields.map((field) => {
          const type = field.type ?? "text";
          const value = values[field.name] ?? "";

          if (type === "checkbox") {
            return (
              <label className="shared-form-checkbox" key={field.name}>
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  disabled={field.disabled}
                  onChange={(event) => onChange(field.name, event.target.checked)}
                />
                <span>
                  <strong>{field.label}{field.required ? " *" : ""}</strong>
                  {field.help ? <small>{field.help}</small> : null}
                </span>
              </label>
            );
          }

          return (
            <label
              className={field.colSpan && field.colSpan > 1 ? `shared-form-field span-${field.colSpan}` : "shared-form-field"}
              key={field.name}
            >
              <span>{field.label}{field.required ? " *" : ""}</span>
              {type === "select" ? (
                <select
                  value={String(value)}
                  required={field.required}
                  disabled={field.disabled}
                  onChange={(event) => onChange(field.name, event.target.value)}
                >
                  {field.options?.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : type === "textarea" ? (
                <textarea
                  value={String(value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  disabled={field.disabled}
                  onChange={(event) => onChange(field.name, event.target.value)}
                />
              ) : (
                <input
                  type={type}
                  value={String(value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  disabled={field.disabled}
                  onChange={(event) => onChange(
                    field.name,
                    type === "number" ? Number(event.target.value) : event.target.value,
                  )}
                />
              )}
              {field.help ? <small>{field.help}</small> : null}
            </label>
          );
        })}
      </div>

      {error ? <p className="shared-form-message error">{error}</p> : null}
      {success ? <p className="shared-form-message success">{success}</p> : null}

      <div className="shared-form-actions">
        {children}
        <button type="submit" className="primary-button compact" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
