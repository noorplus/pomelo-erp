/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { DataTable, PageHeader, PageSection, Select, StatusBadge } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/formatters";

export function AccountLedger({ accounts, account, rows, currency = "BDT" }: { accounts: any[]; account: any; rows: any[]; currency?: string }) {
  const money = (value: number) => formatCurrency(value, currency);
  const [id, setId] = useState(account?.id ?? "");
  return <div className="page">
    <PageHeader eyebrow="Accounting / Accounts" title="Account Ledger" description="Posted account transaction lines from the frozen account_transactions table." />
    <PageSection title="Account">
      <Select value={id} onChange={(e) => { setId(e.target.value); window.location.href = "/accounting/ledger?account=" + e.target.value; }}>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
      </Select>
    </PageSection>
    <PageSection title={account ? account.account_name : "Ledger"}>
      <DataTable rows={rows} columns={[
        { key: "date", header: "Date", render: (r) => formatDate(r.journal_entries?.entry_date) },
        { key: "entry", header: "Entry", render: (r) => r.journal_entries?.entry_number ?? "—" },
        { key: "type", header: "Type", render: (r) => r.journal_entries?.entry_type ?? "—" },
        { key: "line_number", header: "Line", render: (r) => r.line_number },
        { key: "description", header: "Description", render: (r) => r.description || "—" },
        { key: "debit", header: "Debit", align: "right", render: (r) => money(Number(r.debit)) },
        { key: "credit", header: "Credit", align: "right", render: (r) => money(Number(r.credit)) },
        { key: "status", header: "Status", render: (r) => <StatusBadge tone="success">{r.journal_entries?.status ?? "CONFIRMED"}</StatusBadge> },
      ]} empty="No posted ledger transactions found." />
    </PageSection>
  </div>;
}
