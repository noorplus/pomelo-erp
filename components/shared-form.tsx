"use client";

import { FormEvent, ReactNode, useState } from "react";
import type { ActionState } from "@/lib/erp/types";

export type SharedFormProps = {
  action: (formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel?: string;
  className?: string;
  onSuccess?: (state: ActionState) => void;
};

export function SharedForm({
  action,
  children,
  submitLabel = "Save",
  className = "",
  onSuccess,
}: SharedFormProps) {
  const [state, setState] = useState<ActionState>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setState({});

    try {
      const result = await action(new FormData(event.currentTarget));
      setState(result);
      if (result.success) onSuccess?.(result);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className={`erp-form shared-form ${className}`.trim()}
      onSubmit={handleSubmit}
      aria-busy={pending}
    >
      <fieldset className="shared-form-fields" disabled={pending}>
        {children}
      </fieldset>

      {state.error && (
        <p className="form-message error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="form-message success" role="status">
          {state.success}
        </p>
      )}

      <div className="form-actions shared-form-actions">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function FormSection({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`shared-form-section ${className}`.trim()}>
      {(title || description) && (
        <div className="shared-form-section-heading">
          {title && <h3>{title}</h3>}
          {description && <p>{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`shared-form-field ${className}`.trim()} htmlFor={htmlFor}>
      <span>
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
