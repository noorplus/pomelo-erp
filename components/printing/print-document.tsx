"use client";
import { useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Printer } from "lucide-react";
export type PrintColumn = { key: string; label: string; align?: "left" | "center" | "right" };
export type PrintSummaryItem = { label: string; value: string };
export type PrintPartyContact = { contact_number?: string | null; phone?: string | null; email?: string | null; address?: string | null };
export function PrintDocument({
  organizationName = "Pomelo ERP", title, documentNumber, issueDate, status, partyLabel, partyName, partyContact, summary, columns, rows, note,
}: {
  organizationName?: string; title: string; documentNumber: string; issueDate: string; status: string;
  partyLabel: string; partyName: string; partyContact?: PrintPartyContact | null; summary: PrintSummaryItem[];
  columns: PrintColumn[]; rows: Array<Record<string, string | number | null | undefined>>; note?: string;
}) {
  const [printedAt, setPrintedAt] = useState<Date | null>(null);
  const portalTarget = typeof document === "undefined" ? null : document.getElementById("print-portal-root");
  const printDateTime = printedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(printedAt) : "—";
  const printable = <section className="print-document-root" aria-label={`Printable ${title}`}>
    <article className="print-document">
      <header className="print-document-header">
        <div><p className="print-document-brand">{organizationName}</p><p className="print-document-caption">Business document</p></div>
        <div className="print-document-title"><h1>{title}</h1><p>{documentNumber || "Draft"}</p><span className={`print-document-status print-status-${status.toLowerCase()}`}>{status}</span></div>
      </header>
      <div className="print-document-meta">
        <div className="print-document-party">
          <span>{partyLabel}</span><strong>{partyName || "—"}</strong>
          {partyContact?.contact_number ? <p><b>Contact no.:</b> {partyContact.contact_number}</p> : null}
          {partyContact?.phone ? <p><b>Phone:</b> {partyContact.phone}</p> : null}
          {partyContact?.email ? <p><b>Email:</b> {partyContact.email}</p> : null}
          {partyContact?.address ? <p className="print-document-address"><b>Address:</b> {partyContact.address}</p> : null}
        </div>
        <div className="print-document-dates"><div><span>Document date</span><strong>{issueDate || "—"}</strong></div><div><span>Printed on</span><strong>{printDateTime}</strong></div></div>
      </div>
      <table className="print-document-table">
        <thead><tr>{columns.map((column) => <th key={column.key} className={column.align ? `print-align-${column.align}` : ""}>{column.label}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((row, index) => <tr key={String(row.id ?? index)}>{columns.map((column) => <td key={column.key} className={column.align ? `print-align-${column.align}` : ""}>{row[column.key] ?? "—"}</td>)}</tr>) : <tr><td colSpan={columns.length} className="print-empty">No line items.</td></tr>}</tbody>
      </table>
      <div className="print-document-summary">{summary.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
      {note ? <p className="print-document-note">{note}</p> : null}
      <footer className="print-document-footer"><span>Generated from {organizationName}</span><span>Authorized signature: ____________________</span></footer>
    </article>
  </section>;
  return <>
    <button type="button" className="button print-trigger" onClick={() => {
      flushSync(() => setPrintedAt(new Date()));
      window.print();
    }}><Printer size={16} aria-hidden="true" /> Print</button>
    {portalTarget ? createPortal(printable, portalTarget) : null}
  </>;
}
