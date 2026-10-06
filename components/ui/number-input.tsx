import type { InputHTMLAttributes } from "react";

export function NumberInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input {...props} className={`ui-input ${props.className ?? ""}`} inputMode="decimal" type="number" />;
}
