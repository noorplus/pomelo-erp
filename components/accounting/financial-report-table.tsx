"use client";

import Link from "next/link";
import { DataTable } from "@/components/ui";

export type FinancialReportTableRow = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
  balance: number;
};

function money(value: number) {
  return value.toFixed(2);
}

export function FinancialReportTable({ rows }: { rows: FinancialReportTableRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={[
        { key: "code", header: "Code", render: (r) => <Link href={"/accounting/ledger?account=" + r.id}>{r.account_code}</Link> },
        { key: "name", header: "Account", render: (r) => r.account_name },
        { key: "type", header: "Class", render: (r) => r.account_type },
        { key: "debit", header: "Debit", render: (r) => money(r.debit) },
        { key: "credit", header: "Credit", render: (r) => money(r.credit) },
        { key: "balance", header: "Balance", render: (r) => money(r.balance) },
      ]}
      empty="No posted account activity found."
    />
  );
}
