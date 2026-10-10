"use client";

import { useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Printer } from "lucide-react";

export type PrintColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
};
export type PrintSummaryItem = { label: string; value: string };
export type PrintPartyContact = {
  contact_number?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

function printableStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function PrintDocument({
  organizationName = "Pomelo ERP",
  title,
  documentNumber,
  issueDate,
  status,
  partyLabel,
  partyName,
  partyContact,
  summary,
  columns,
  rows,
  note,
}: {
  organizationName?: string;
  title: string;
  documentNumber: string;
  issueDate: string;
  status: string;
  partyLabel: string;
  partyName: string;
  partyContact?: PrintPartyContact | null;
  summary: PrintSummaryItem[];
  columns: PrintColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
  note?: string;
}) {
  const [printedAt, setPrintedAt] = useState<Date | null>(null);
  const portalTarget = typeof document === "undefined" ? null : document.getElementById("print-portal-root");
  const printDateTime = printedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(printedAt)
    : "—";
  const contacts = [
    ["Contact no.", partyContact?.contact_number],
    ["Phone", partyContact?.phone],
    ["Email", partyContact?.email],
    ["Address", partyContact?.address],
  ].filter(([, value]) => typeof value === "string" && value.trim().length > 0) as [string, string][];
  const printable = (
    <section className="print-document-root" aria-label={`Printable ${title}`}>
      <article className="print-document">
        <header className="print-document-header">
          <div className="print-document-issuer">
            <p className="print-document-brand">{organizationName}</p>
            <p className="print-document-caption">Business document</p>
          </div>
          <div className="print-document-title">
            <p className="print-document-kind">Document</p>
            <h1>{title}</h1>
            <p className="print-document-number">{documentNumber || "Draft"}</p>
            <span className={`print-document-status print-status-${status.toLowerCase()}`}>{printableStatus(status)}</span>
          </div>
        </header>

        <section className="print-document-meta" aria-label="Document and contact details">
          <div className="print-document-party">
            <span className="print-document-section-label">{partyLabel}</span>
            <strong className="print-document-party-name">{partyName || "—"}</strong>
            {contacts.map(([label, value]) => (
              <p key={label} className={label === "Address" ? "print-document-address" : undefined}>
                <b>{label}:</b> {value}
              </p>
            ))}
          </div>
          <div className="print-document-dates">
            <div><span>Document date</span><strong>{issueDate || "—"}</strong></div>
            <div><span>Printed on</span><strong>{printDateTime}</strong></div>
          </div>
        </section>

        <table className="print-document-table">
          <thead>
            <tr>{columns.map((column) => <th key={column.key} className={column.align ? `print-align-${column.align}` : ""}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr key={String(row.id ?? index)}>
                {columns.map((column) => (
                  <td key={column.key} className={column.align ? `print-align-${column.align}` : ""}>{row[column.key] ?? "—"}</td>
                ))}
              </tr>
            )) : <tr><td colSpan={columns.length} className="print-empty">No line items recorded.</td></tr>}
          </tbody>
        </table>

        {summary.length > 0 ? (
          <section className="print-document-summary" aria-label="Document totals">
            {summary.map((item, index) => (
              <div key={item.label} className={index === summary.length - 1 ? "print-document-summary-total" : undefined}>
                <span>{item.label}</span><strong>{item.value}</strong>
              </div>
            ))}
          </section>
        ) : null}
        {note ? <p className="print-document-note">{note}</p> : null}
        <footer className="print-document-footer">
          <span>Generated from {organizationName}</span>
          <span className="print-document-signature">Authorized signature <i /></span>
        </footer>
      </article>
    </section>
  );

  return (
    <>
      <button
        type="button"
        className="button print-trigger"
        onClick={() => {
          flushSync(() => setPrintedAt(new Date()));
          window.print();
        }}
      >
        <Printer size={16} aria-hidden="true" /> Print
      </button>
      {portalTarget ? createPortal(printable, portalTarget) : null}
    </>
  );
}
