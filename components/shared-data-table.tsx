"use client";

import { useMemo, useState } from "react";

export type SharedTableColumn<T> = {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  editable?: boolean;
  inputType?: "text" | "number";
  render?: (row: T, index: number) => React.ReactNode;
};

type SharedDataTableProps<T extends Record<string, unknown>> = {
  columns: SharedTableColumn<T>[];
  data: T[];
  rowKey?: (row: T, index: number) => string;
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyTitle?: string;
  emptyDescription?: string;
  ariaLabel?: string;
  editing?: boolean;
  onCellChange?: (row: T, column: SharedTableColumn<T>, value: string) => void;
  className?: string;
};

function comparable(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  const text = String(value).trim();
  const numeric = Number(text.replace(/,/g, ""));
  return text !== "" && Number.isFinite(numeric) ? numeric : text.toLocaleLowerCase();
}

export function SharedDataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  pageSize = 25,
  pageSizeOptions = [25, 50, 100],
  emptyTitle = "No records",
  emptyDescription = "There are no records to display.",
  ariaLabel = "Data table",
  editing = false,
  onCellChange,
  className = "",
}: SharedDataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const column = columns.find((item) => item.key === sortKey);
    if (!column) return data;

    return [...data].sort((a, b) => {
      const left = comparable(a[sortKey]);
      const right = comparable(b[sortKey]);
      if (left === right) return 0;
      const result = left < right ? -1 : 1;
      return sortDirection === "asc" ? result : -result;
    });
  }, [columns, data, sortDirection, sortKey]);

  const total = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * rowsPerPage;
  const end = Math.min(start + rowsPerPage, total);
  const visibleRows = sortedData.slice(start, end);

  function changeSort(column: SharedTableColumn<T>) {
    if (!column.sortable) return;
    setPage(1);
    if (sortKey === column.key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column.key);
      setSortDirection("asc");
    }
  }

  function changePageSize(value: number) {
    const next = Math.max(1, Math.min(200, value || 25));
    setRowsPerPage(next);
    setPage(1);
  }

  return (
    <section className={`shared-table-card ${className}`}>
      {total === 0 ? (
        <div className="empty-state">
          <strong>{emptyTitle}</strong>
          <span>{emptyDescription}</span>
        </div>
      ) : (
        <>
          <div className="shared-table-scroll">
            <table className="shared-table" aria-label={ariaLabel}>
              <colgroup>
                {columns.map((column) => (
                  <col key={column.key} style={column.width ? { width: column.width } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {columns.map((column) => {
                    const active = sortKey === column.key;
                    return (
                      <th
                        key={column.key}
                        className={column.align ? `align-${column.align}` : ""}
                        aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                      >
                        {column.sortable ? (
                          <button
                            type="button"
                            className="shared-table-sort"
                            onClick={() => changeSort(column)}
                            title={`Sort by ${column.label}`}
                          >
                            <span>{column.label}</span>
                            <span className={active ? "sort-indicator active" : "sort-indicator"} aria-hidden="true">
                              {active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                            </span>
                          </button>
                        ) : (
                          column.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, rowIndex) => {
                  const absoluteIndex = start + rowIndex;
                  const key = rowKey ? rowKey(row, absoluteIndex) : String(rowIndex);
                  return (
                    <tr key={key}>
                      {columns.map((column) => {
                        const value = row[column.key];
                        const content = column.render
                          ? column.render(row, absoluteIndex)
                          : String(value ?? "");

                        return (
                          <td
                            key={column.key}
                            className={column.align ? `align-${column.align}` : ""}
                          >
                            {editing && column.editable ? (
                              <input
                                className="shared-table-input"
                                type={column.inputType ?? "text"}
                                value={String(value ?? "")}
                                onChange={(event) => onCellChange?.(row, column, event.target.value)}
                                aria-label={`${column.label}, row ${absoluteIndex + 1}`}
                              />
                            ) : (
                              content
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="shared-table-footer">
            <div className="shared-table-summary">
              Showing <strong>{start + 1}</strong>–<strong>{end}</strong> of <strong>{total}</strong>
            </div>

            <label className="shared-table-page-size">
              <span>Rows</span>
              <input
                type="number"
                min={1}
                max={200}
                value={rowsPerPage}
                onChange={(event) => changePageSize(Number(event.target.value))}
                aria-label="Rows per page"
              />
            </label>

            <div className="shared-table-pagination" aria-label="Pagination">
              <button
                type="button"
                className="shared-table-page-button"
                disabled={safePage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span>Page {safePage} of {totalPages}</span>
              <button
                type="button"
                className="shared-table-page-button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
