import type { InputHTMLAttributes } from "react";

export function DatePicker(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input {...props} className={`ui-input ${props.className ?? ""}`} type="date" />;
}
