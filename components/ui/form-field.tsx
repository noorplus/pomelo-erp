import type { ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="ui-form-field">
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true" className="ui-required"> *</span> : null}
      </label>
      {children}
      {error ? <p className="ui-field-error">{error}</p> : hint ? <p className="ui-field-hint">{hint}</p> : null}
    </div>
  );
}
