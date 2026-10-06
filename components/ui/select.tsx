import type { SelectHTMLAttributes } from "react";

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`ui-input ui-select ${props.className ?? ""}`} {...props} />;
}
