"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createPaymentAllocation, deletePaymentAllocation } from "@/lib/accounting/actions";
import { DataTable, FormActions, FormField, PageHeader, PageSection, Select, StatusBadge } from "@/components/ui";
import { PrintDocument } from "@/components/printing/print-document";
import { formatCurrency, formatDate } from "@/lib/formatters";

type Payment = { id: string; payment_number: string | null; payment_type: string; contact_id: string | null; payment_date: string; amount: number; status: string; description: string | null };
type Allocation = { id: string; document_type: string; document_id: string; allocated_amount: number };
type Doc = { id: string; label: string; date: string; amount: number };

export function PaymentDetail({ organizationId, payment, allocations, documents, contactName, organizationName = "Pomelo ERP", currency = "BDT" }: {
  organizationId: string; payment: Payment; allocations: Allocation[]; documents: { sales: Doc[]; purchases: Doc[]; expenses: Doc[] }; contactName: string; organizationName?: string; currency?: string;
}) {
  const money = (value: number) => formatCurrency(value, currency);
  const router = useRouter();
  const [type, setType] = useState(payment.payment_type === "RECEIPT" ? "SALES" : "PURCHASE");
  const [documentId, setDocumentId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const options = type === "SALES" ? documents.sales : type === "PURCHASE" ? documents.purchases : documents.expenses;
  const documentLabel = (allocation: Allocation) => {
    const list = allocation.document_type === "SALES"
      ? documents.sales
      : allocation.document_type === "PURCHASE"
        ? documents.purchases
        : documents.expenses;
    return list.find((document) => document.id === allocation.document_id)?.label ?? allocation.document_id;
  };
  const allocated = allocations.reduce((sum, a) => sum + Number(a.allocated_amount), 0);
  const remaining = Number(payment.amount) - allocated;

  async function add(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (payment.status !== "DRAFT") throw new Error("Allocations can only be changed while the payment is DRAFT.");
      if (!payment.contact_id) throw new Error("A contact is required before allocating this payment.");
      const value = Number(amount);
      if (!documentId || value <= 0) throw new Error("Select a document and enter a positive allocation.");
      if (value > remaining + 0.000001) throw new Error("Allocation exceeds the remaining payment amount.");
      await createPaymentAllocation(createClient(), organizationId, { payment_id: payment.id, document_type: type, document_id: documentId, allocated_amount: value });
      setDocumentId(""); setAmount(""); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create allocation."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true); setError("");
    try { await deletePaymentAllocation(createClient(), organizationId, id); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to remove allocation."); }
    finally { setBusy(false); }
  }

  return <div className="page">
    <PageHeader eyebrow="Accounting / Payments" title={payment.payment_number ?? "Draft payment"} description="Review and manage payment allocations before confirmation." actions={<PrintDocument organizationName={organizationName} title={payment.payment_type === "RECEIPT" ? "Payment Receipt" : "Payment Voucher"} documentNumber={payment.payment_number ?? "Draft"} issueDate={payment.payment_date} status={payment.status} partyLabel="Contact" partyName={contactName || "No contact"} summary={[{label:"Payment amount",value:money(Number(payment.amount))},{label:"Allocated",value:money(allocated)},{label:"Remaining",value:money(remaining)}]} columns={[{key:"document",label:"Allocated document"},{key:"amount",label:"Allocated amount",align:"right"}]} rows={allocations.map((a) => ({id:a.id,document:documentLabel(a),amount:money(Number(a.allocated_amount))}))} note={payment.description ?? undefined} />} />
    <PageSection title="Payment">
      <div className="ui-detail-grid">
        <div><span>Type</span><strong>{payment.payment_type}</strong></div>
        <div><span>Date</span><strong>{formatDate(payment.payment_date)}</strong></div>
        <div><span>Contact</span><strong>{contactName || "No contact"}</strong></div>
        <div><span>Amount</span><strong>{money(Number(payment.amount))}</strong></div>
        <div><span>Allocated</span><strong>{money(allocated)}</strong></div>
        <div><span>Remaining</span><strong>{money(remaining)}</strong></div>
        <div><span>Status</span><strong><StatusBadge tone={payment.status === "CONFIRMED" ? "success" : payment.status === "CANCELLED" ? "danger" : "neutral"}>{payment.status}</StatusBadge></strong></div>
      </div>
    </PageSection>
    {payment.status === "DRAFT" ? <PageSection title="Add allocation" description="The database will perform the final document, contact, outstanding-balance and account-type validation when the payment is confirmed.">
      <form className="ui-form-grid" onSubmit={add}>
        <FormField label="Document type" htmlFor="document-type" required><Select id="document-type" value={type} onChange={(e) => { setType(e.target.value); setDocumentId(""); }}><option value="SALES">SALES</option><option value="PURCHASE">PURCHASE</option><option value="EXPENSE">EXPENSE</option></Select></FormField>
        <FormField label="Document" htmlFor="document" required><Select id="document" value={documentId} onChange={(e) => setDocumentId(e.target.value)}><option value="">Select document</option>{options.map((d) => <option key={d.id} value={d.id}>{d.label} · {formatDate(d.date)} · {money(Number(d.amount))}</option>)}</Select></FormField>
        <FormField label="Allocated amount" htmlFor="allocation-amount" required><input id="allocation-amount" className="ui-input" type="number" min="0.01" step="0.01" max={Math.max(0, remaining)} value={amount} onChange={(e) => setAmount(e.target.value)} /></FormField>
        {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
        <FormActions><button className="button primary" disabled={busy || remaining <= 0} type="submit">Add allocation</button></FormActions>
      </form>
    </PageSection> : null}
    <PageSection title="Allocations">
      <DataTable rows={allocations} columns={[
        { key: "type", header: "Document type", render: (a) => a.document_type },
        { key: "document", header: "Document", render: (a) => documentLabel(a) },
        { key: "amount", header: "Allocated", align: "right", render: (a) => money(Number(a.allocated_amount)) },
        { key: "action", header: "Action", render: (a) => payment.status === "DRAFT" ? <button className="button" type="button" disabled={busy} onClick={() => remove(a.id)}>Remove</button> : null },
      ]} empty="No payment allocations." />
    </PageSection>
  </div>;
}
