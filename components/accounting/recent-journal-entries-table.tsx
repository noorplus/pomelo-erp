"use client";

import { DataTable, StatusBadge } from "@/components/ui";

export type RecentJournalEntryRow = {
  id: string;
  entry_number: string;
  entry_date: string;
  entry_type: string;
  status: string;
  description: string | null;
};

export function RecentJournalEntriesTable({ rows }: { rows: RecentJournalEntryRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={[
        { key: "number", header: "Entry", render: (entry) => entry.entry_number },
        { key: "date", header: "Date", render: (entry) => entry.entry_date },
        { key: "type", header: "Type", render: (entry) => entry.entry_type },
        {
          key: "status",
          header: "Status",
          render: (entry) => (
            <StatusBadge
              tone={
                entry.status === "CONFIRMED"
                  ? "success"
                  : entry.status === "CANCELLED"
                    ? "danger"
                    : "neutral"
              }
            >
              {entry.status}
            </StatusBadge>
          ),
        },
        { key: "description", header: "Description", render: (entry) => entry.description ?? "—" },
      ]}
      empty="No journal entries found."
    />
  );
}
