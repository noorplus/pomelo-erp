type DataTableProps = {
  children: React.ReactNode;
  minWidth?: number;
  className?: string;
  ariaLabel?: string;
};

export function DataTable({
  children,
  minWidth = 720,
  className = "",
  ariaLabel,
}: DataTableProps) {
  return (
    <div className={`data-table-scroll ${className}`}>
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

export function DataTableEmpty({
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
