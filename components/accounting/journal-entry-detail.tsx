/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { DataTable, PageHeader, PageSection, StatusBadge } from "@/components/ui";

export function JournalEntryDetail({ entry, lines }: { entry: any; lines: any[] }) {
  const tone = entry.status === "CONFIRMED" ? "success" : entry.status === "CANCELLED" ? "danger" : "neutral";
  const debit = lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
  const credit = lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
  return <div className="page">
    <PageHeader eyebrow="Accounting / Transactions" title={entry.entry_number ?? "Draft journal"} description={entry.description ?? "Journal entry detail."} actions={<Link className="button" href="/accounting/transactions/journal-entries">Back to journal entries</Link>} />
    <PageSection title="Journal header">
      <div className="ui-detail-grid">
        <div><span>Entry number</span><strong>{entry.entry_number ?? "Draft"}</strong></div>
        <div><span>Date</span><strong>{entry.entry_date}</strong></div>
        <div><span>Type</span><strong>{entry.entry_type}</strong></div>
        <div><span>Status</span><strong><StatusBadge tone={tone}>{entry.status}</StatusBadge></strong></div>
        <div><span>Reference</span><strong>{entry.reference_type ?? "—"}</strong></div>
        <div><span>Posted</span><strong>{entry.posted_at ? new Date(entry.posted_at).toLocaleString() : "—"}</strong></div>
      </div>
    </PageSection>
    <PageSection title="Lines">
      <DataTable rows={lines} columns={[
        { key: "line", header: "Line", render: (l) => l.line_number },
        { key: "account", header: "Account", render: (l) => l.accounts ? l.accounts.account_code + " — " + l.accounts.account_name : l.account_id },
        { key: "description", header: "Description", render: (l) => l.description || "—" },
        { key: "debit", header: "Debit", render: (l) => Number(l.debit).toFixed(2) },
        { key: "credit", header: "Credit", render: (l) => Number(l.credit).toFixed(2) },
      ]} empty="No journal lines found." />
    </PageSection>
    <PageSection title="Totals"><div className="ui-detail-grid"><div><span>Debit</span><strong>{debit.toFixed(2)}</strong></div><div><span>Credit</span><strong>{credit.toFixed(2)}</strong></div><div><span>Difference</span><strong>{(debit-credit).toFixed(2)}</strong></div></div></PageSection>
  </div>;
}
