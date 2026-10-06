import type { ReactNode } from "react";

export function DataTableToolbar({
  search,
  filters,
  actions,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="ui-table-toolbar">
      <div className="ui-table-toolbar-main">{search}{filters}</div>
      {actions ? <div className="ui-table-toolbar-actions">{actions}</div> : null}
    </div>
  );
}
