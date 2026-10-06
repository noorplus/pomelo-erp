import type { InputHTMLAttributes } from "react";

export function CurrencyInput({ currency = "BDT", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { currency?: string }) {
  return (
    <div className="ui-input-prefix">
      <span aria-hidden="true">{currency}</span>
      <input {...props} className={`ui-input ${props.className ?? ""}`} inputMode="decimal" type="number" step="0.01" />
    </div>
  );
}
