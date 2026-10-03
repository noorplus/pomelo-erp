import type { ReactNode, CSSProperties } from "react";

export type SharedDataTableProps = {
  children: ReactNode;
  minWidth?: number;
  className?: string;
  ariaLabel?: string;
  style?: CSSProperties;
};

export function SharedDataTable({
  children,
  minWidth = 720,
  className = "",
  ariaLabel,
  style,
}: SharedDataTableProps) {
  return (
    <div className={`data-table-scroll ${className}`} style={style}>
      <table
        className="data-table"
        style={{ minWidth: `${minWidth}px` }}
        aria-label={ariaLabel}
      >
        {children}
      </table>
    </div>
  );
}

export function SharedDataTableEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
