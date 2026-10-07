import type { CSSProperties, ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  caption,
  empty,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  caption?: string;
  empty?: ReactNode;
}) {
  const gridStyle = { "--ui-table-column-count": columns.length } as CSSProperties;

  return (
    <div className="ui-table-wrap">
      {caption ? <div className="ui-table-caption">{caption}</div> : null}
      <div className="ui-table-grid" role="table" aria-colcount={columns.length} aria-rowcount={rows.length + 1} style={gridStyle}>
        <div className="ui-table-grid-row ui-table-grid-header" role="row">
          {columns.map((column) => (
            <div className={["ui-table-grid-cell", "ui-table-grid-header-cell", column.className].filter(Boolean).join(" ")} key={column.key} role="columnheader">
              {column.header}
            </div>
          ))}
        </div>
        {rows.length ? rows.map((row) => (
          <div className="ui-table-grid-row" key={row.id} role="row">
            {columns.map((column) => (
              <div className={["ui-table-grid-cell", column.className].filter(Boolean).join(" ")} key={column.key} role="cell">
                {column.render(row)}
              </div>
            ))}
          </div>
        )) : (
          <div className="ui-table-grid-empty" role="row">
            <div className="ui-table-empty-cell" role="cell">{empty ?? "No records found."}</div>
          </div>
        )}
      </div>
    </div>
  );
}
