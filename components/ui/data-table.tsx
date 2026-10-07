import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Pagination } from "./pagination";

export type DataTableRowAction<T> = { label: string; onClick: (row: T) => void; disabled?: (row: T) => boolean };\n\nexport type DataTableColumn<T> = {
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
  loading = false,
  error,
  onRetry,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  pagination,
  selectable = false,
  selectedIds,
  onSelectionChange,
  columnVisibility = false,
  rowActions = [],
  bulkActions,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  caption?: string;
  empty?: ReactNode;
  loading?: boolean;
  error?: ReactNode;
  onRetry?: () => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  pagination?: { page: number; pageCount: number; onPageChange: (page: number) => void };
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  columnVisibility?: boolean;
  rowActions?: DataTableRowAction<T>[];
  bulkActions?: ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [localSelected, setLocalSelected] = useState<string[]>([]);
  const [visibleKeys, setVisibleKeys] = useState(columns.map((column) => column.key));
  const visibleColumns = columns.filter((column) => visibleKeys.includes(column.key) || !column.hideable);
  const processedRows = useMemo(() => {
    let result = rows;
    if (search?.trim()) {
      const query = search.trim().toLowerCase();
      result = result.filter((row) => columns.some((column) => column.accessor?.(row)?.toString().toLowerCase().includes(query)));
    }
    if (sort) {
      const column = columns.find((item) => item.key === sort.key);
      if (column?.accessor) result = [...result].sort((a, b) => {
        const av = column.accessor?.(a), bv = column.accessor?.(b);
        if (av == null) return bv == null ? 0 : 1;
        if (bv == null) return -1;
        const value = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
        return sort.direction === "asc" ? value : -value;
      });
    }
    return result;
  }, [columns, rows, search, sort]);
  const selected = selectedIds ?? localSelected;
  const gridStyle = { "--ui-table-column-count": visibleColumns.length + (selectable ? 1 : 0) + (rowActions.length ? 1 : 0) } as CSSProperties;

  if (error) return <div className="ui-state ui-error-state"><strong>Unable to load records</strong><span>{error}</span>{onRetry ? <button className="button" type="button" onClick={onRetry}>Retry</button> : null}</div>;
  return (
    <div className="ui-data-table">
      {(search || columnVisibility || selected.length > 0) ? <div className="ui-data-table-toolbar"><div className="ui-data-table-toolbar-main">{onSearchChange ? <input className="ui-input ui-table-search-input" value={search ?? ""} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} aria-label="Search table" /> : search ? <span className="ui-table-result-count">Search: {search}</span> : null}{selected.length > 0 ? <span className="ui-table-result-count">{selected.length} selected</span> : null}{selected.length > 0 && bulkActions ? bulkActions : null}</div>{columnVisibility ? <details><summary className="button">Columns</summary><div className="ui-data-table-columns-menu">{columns.filter((column) => column.hideable).map((column) => <label key={column.key}><input type="checkbox" checked={visibleKeys.includes(column.key)} onChange={() => setVisibleKeys((keys) => keys.includes(column.key) ? keys.filter((key) => key !== column.key) : [...keys, column.key])} /> {column.header}</label>)}</div></details> : null}</div> : null}
      {caption ? <div className="ui-table-caption">{caption}</div> : null}
      <div className="ui-table-grid" role="table" aria-colcount={visibleColumns.length + (selectable ? 1 : 0)} aria-rowcount={processedRows.length + 1} style={gridStyle}>
        <div className="ui-table-grid-row ui-table-grid-header" role="row">
          {selectable ? <div className="ui-table-grid-cell ui-table-grid-header-cell" role="columnheader"><input aria-label="Select all rows" type="checkbox" checked={processedRows.length > 0 && processedRows.every((row) => selected.includes(row.id))} onChange={() => { const ids = processedRows.map((row) => row.id); const next = processedRows.every((row) => selected.includes(row.id)) ? selected.filter((id) => !ids.includes(id)) : Array.from(new Set([...selected, ...ids])); setLocalSelected(next); onSelectionChange?.(next); }} /></div> : null}{visibleColumns.map((column) => (
            <div className={["ui-table-grid-cell", "ui-table-grid-header-cell", column.className].filter(Boolean).join(" ")} key={column.key} role="columnheader">
              {column.sortable && column.accessor ? <button className="ui-table-sort-button" type="button" onClick={() => setSort((current) => current?.key === column.key ? (current.direction === "asc" ? { key: column.key, direction: "desc" } : null) : { key: column.key, direction: "asc" })}>{column.header}{sort?.key === column.key ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}</button> : column.header}
            </div>
          ))}{rowActions.length ? <div className="ui-table-grid-cell ui-table-grid-header-cell ui-table-actions-cell" role="columnheader">Actions</div> : null}
        </div>
        {loading ? <div className="ui-table-grid-empty" role="row"><div className="ui-table-empty-cell"><div className="ui-spinner" aria-label="Loading" /></div></div> : processedRows.length ? processedRows.map((row) => (
          <div className="ui-table-grid-row" key={row.id} role="row" aria-selected={selectable ? selected.includes(row.id) : undefined}>
            {selectable ? <div className="ui-table-grid-cell" role="cell"><input aria-label={"Select row " + row.id} type="checkbox" checked={selected.includes(row.id)} onChange={() => { const next = selected.includes(row.id) ? selected.filter((id) => id !== row.id) : [...selected, row.id]; setLocalSelected(next); onSelectionChange?.(next); }} /></div> : null}
            {visibleColumns.map((column) => (
              <div className={["ui-table-grid-cell", column.className].filter(Boolean).join(" ")} key={column.key} role="cell">
                {selectable ? null : null}{column.render(row)}
              </div>
            ))}
            {rowActions.length ? <div className="ui-table-grid-cell ui-table-actions-cell" role="cell"><div className="ui-table-row-actions">{rowActions.map((action) => <button className="button" type="button" key={action.label} disabled={action.disabled?.(row)} onClick={() => action.onClick(row)}>{action.label}</button>)}</div></div> : null}
          </div>
        )) : (
          <div className="ui-table-grid-empty" role="row">
            <div className="ui-table-empty-cell" role="cell">{empty ?? "No records found."}</div>
          </div>
        )}
      </div>
      {pagination ? <Pagination page={pagination.page} pageCount={pagination.pageCount} onPageChange={pagination.onPageChange} /> : null}
    </div>
  );
}
