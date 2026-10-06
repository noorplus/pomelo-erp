import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  width?: string;
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
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.className} key={column.key} scope="col" style={{ width: column.width }}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td className={column.className} key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          )) : (
            <tr><td className="ui-table-empty" colSpan={columns.length}>{empty ?? "No records found."}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
