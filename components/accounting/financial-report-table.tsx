"use client";

import Link from "next/link";
import { DataTable } from "@/components/ui";
import { formatCurrency } from "@/lib/formatters";

export type FinancialReportTableRow = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
  balance: number;
};

export function FinancialReportTable({ rows, currency = "BDT" }: { rows: FinancialReportTableRow[]; currency?: string }) {
  const money = (value: number) => formatCurrency(value, currency);
  return (
    <DataTable
      rows={rows}
      columns={[
        { key: "code", header: "Code", render: (r) => <Link href={"/accounting/ledger?account=" + r.id}>{r.account_code}</Link> },
        { key: "name", header: "Account", render: (r) => r.account_name },
        { key: "type", header: "Class", render: (r) => r.account_type },
        { key: "debit", header: "Debit", align: "right", render: (r) => money(r.debit) },
        { key: "credit", header: "Credit", align: "right", render: (r) => money(r.credit) },
        { key: "balance", header: "Balance", align: "right", render: (r) => money(r.balance) },
      ]}
      empty="No posted account activity found."
    />
  );
}
