"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { DataTable, PageHeader, PageSection, StatusBadge } from "@/components/ui";
import { PrintDocument } from "@/components/printing/print-document";

export function JournalEntryDetail({ entry, lines, source, organizationName = "Pomelo ERP" }: { entry: any; lines: any[]; source: { label: string; href: string } | null; organizationName?: string }) {
  const tone = entry.status === "CONFIRMED" ? "success" : entry.status === "CANCELLED" ? "danger" : "neutral";
  const debit = lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
  const credit = lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
  return <div className="page">
    <PageHeader eyebrow="Accounting / Transactions" title={entry.entry_number ?? "Draft journal"} description={entry.description ?? "Journal entry detail."} actions={<><PrintDocument organizationName={organizationName} title="Journal Entry" documentNumber={entry.entry_number ?? "Draft"} issueDate={entry.entry_date} status={entry.status} partyLabel="Reference" partyName={source?.label ?? entry.reference_type ?? "Journal entry"} summary={[{label:"Debit",value:debit.toFixed(2)},{label:"Credit",value:credit.toFixed(2)},{label:"Difference",value:(debit-credit).toFixed(2)}]} columns={[{key:"line",label:"Line",align:"center"},{key:"account",label:"Account"},{key:"description",label:"Description"},{key:"debit",label:"Debit",align:"right"},{key:"credit",label:"Credit",align:"right"}]} rows={lines.map((line) => ({id:line.id,line:String(line.line_number),account:line.accounts ? line.accounts.account_code + " — " + line.accounts.account_name : line.account_id,description:line.description || "—",debit:Number(line.debit).toFixed(2),credit:Number(line.credit).toFixed(2)}))} note={entry.description ?? undefined} </><Link className="button" href="/accounting/transactions/journal-entries">Back to journal entries</Link></>} </PageHeader>
    <PageSection title="Journal header">
      <div className="ui-detail-grid">
        <div><span>Entry number</span><strong>{entry.entry_number ?? "Draft"}</strong></div>
        <div><span>Date</span><strong>{entry.entry_date}</strong></div>
        <div><span>Type</span><strong>{entry.entry_type}</strong></div>
        <div><span>Status</span><strong><StatusBadge tone={tone}>{entry.status}</StatusBadge></strong></div>
        <div><span>Reference</span><strong>{entry.reference_type ?? "—"}{source ? <> · <Link href={source.href}>{source.label}</Link></> : ""}</strong></div>
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
