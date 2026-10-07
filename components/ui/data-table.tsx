import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  accessor?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  hideable?: boolean;
  align?: "left" | "center" | "right";
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
  loading?: boolean;
  error?: ReactNode;
  onRetry?: () => void;
  search?: string;
  pagination?: { page: number; pageCount: number; onPageChange: (page: number) => void };
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  columnVisibility?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);\n  const [localSelected, setLocalSelected] = useState<string[]>([]);\n  const [visibleKeys, setVisibleKeys] = useState(columns.map((column) => column.key));\n  const selected = selectedIds ?? localSelected;\n  const visibleColumns = columns.filter((column) => visibleKeys.includes(column.key) || !column.hideable);\n  const processedRows = useMemo(() => {\n    let result = rows;\n    if (search?.trim()) {\n      const query = search.trim().toLowerCase();\n      result = result.filter((row) => columns.some((column) => column.accessor?.(row)?.toString().toLowerCase().includes(query)));\n    }\n    if (sort) {\n      const column = columns.find((item) => item.key === sort.key);\n      if (column?.accessor) result = [...result].sort((a, b) => {\n        const av = column.accessor?.(a), bv = column.accessor?.(b);\n        if (av == null) return bv == null ? 0 : 1;\n        if (bv == null) return -1;\n        const value = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });\n        return sort.direction === "asc" ? value : -value;\n      });\n    }\n    return result;\n  }, [columns, rows, search, sort]);\n  const gridStyle = { "--ui-table-column-count": visibleColumns.length + (selectable ? 1 : 0) } as CSSProperties;

  return (
    <div className="ui-table-wrap">
      {caption ? <div className="ui-table-caption">{caption}</div> : null}
      <div className="ui-table-grid" role="table" aria-colcount={columns.length} aria-rowcount={rows.length + 1} style={gridStyle}>
        <div className="ui-table-grid-row ui-table-grid-header" role="row">
          {selectable ? <div className="ui-table-grid-cell ui-table-grid-header-cell" role="columnheader"><input aria-label="Select all rows" type="checkbox" checked={processedRows.length > 0 && processedRows.every((row) => selected.includes(row.id))} onChange={() => { const ids = processedRows.map((row) => row.id); const next = processedRows.every((row) => selected.includes(row.id)) ? selected.filter((id) => !ids.includes(id)) : Array.from(new Set([...selected, ...ids])); setLocalSelected(next); onSelectionChange?.(next); }} /></div> : null}{visibleColumns.map((column) => (
            <div className={["ui-table-grid-cell", "ui-table-grid-header-cell", column.className].filter(Boolean).join(" ")} key={column.key} role="columnheader">
              {column.header}
            </div>
          ))}
        </div>
        {loading ? <div className="ui-table-grid-empty" role="row"><div className="ui-table-empty-cell"><div className="ui-spinner" aria-label="Loading" /></div></div> : processedRows.length ? processedRows.map((row) => (
          <div className="ui-table-grid-row" key={row.id} role="row" aria-selected={selectable ? selected.includes(row.id) : undefined}>
            {columns.map((column) => (
              <div className={["ui-table-grid-cell", column.className].filter(Boolean).join(" ")} key={column.key} role="cell">
                {selectable ? null : null}{column.render(row)}
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
