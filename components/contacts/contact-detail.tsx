"use client";

import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { DataTable, PageHeader, PageSection, StatusBadge } from "@/components/ui";
import type { Tables } from "@/lib/supabase/database";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";

type Contact = Tables<"contacts">;
type Activity = {
  sales: Array<{ id: string; invoice_id: string | null; invoice_date: string; total_amount: number; status: string }>;
  purchases: Array<{ id: string; invoice_id: string | null; invoice_date: string; total_amount: number; status: string }>;
  payments: Array<{ id: string; payment_number: string | null; payment_date: string; payment_type: string; amount: number; status: string }>;
  expenses: Array<{ id: string; expense_number: string | null; expense_date: string; amount: number; status: string }>;
  allocations: Array<{ id: string; payment_id: string; document_id: string; allocated_amount: number }>;
  confirmedSales: number; confirmedPurchases: number; confirmedPayments: number; confirmedExpenses: number; allocatedPayments: number;
};
const tone = (status: string) => status === "CONFIRMED" ? "success" : status === "CANCELLED" ? "danger" : "neutral";

export function ContactDetail({ contact, activity, currency = "BDT" }: { contact: Contact; activity: Activity; currency?: string }) {
  const money = (value: number) => formatCurrency(value, currency);
  return <div className="page contacts-detail-page">
    <PageHeader eyebrow="Contacts" title={contact.name} description={contact.contact_number ?? "Contact details"} actions={<><Link className="button" href="/contacts"><ArrowLeft size={16} /> Contacts</Link><Link className="button primary" href={`/contacts/new?id=${contact.id}`}><Pencil size={16} /> Edit</Link></>} />
    <PageSection title="Activity summary" description="Confirmed sales, purchases, payments and allocations for this contact."><div className="ui-detail-grid"><div><span>Confirmed sales</span><strong>{money(activity.confirmedSales)}</strong></div><div><span>Confirmed purchases</span><strong>{money(activity.confirmedPurchases)}</strong></div><div><span>Confirmed payments</span><strong>{money(activity.confirmedPayments)}</strong></div><div><span>Allocated payments</span><strong>{money(activity.allocatedPayments)}</strong></div></div></PageSection>
    <PageSection title="Contact details" actions={<StatusBadge tone={contact.is_active ? "success" : "neutral"}>{contact.is_active ? "Active" : "Inactive"}</StatusBadge>}>
      <div className="ui-detail-grid">
        <div><span>Contact number</span><strong>{contact.contact_number ?? "—"}</strong></div><div><span>Name</span><strong>{contact.name}</strong></div>
        <div><span>Phone</span><strong>{contact.phone ?? "—"}</strong></div><div><span>Email</span><strong>{contact.email ?? "—"}</strong></div>
        <div><span>Address</span><strong>{contact.address ?? "—"}</strong></div><div><span>Created</span><strong>{formatDateTime(contact.created_at)}</strong></div>
        <div><span>Last updated</span><strong>{formatDateTime(contact.updated_at)}</strong></div>
      </div>
    </PageSection>
    <PageSection title="Sales" description="Documents linked to this contact.">
      <DataTable rows={activity.sales} columns={[
        { key:"number",header:"Invoice",render:r=>r.invoice_id??r.id },{key:"date",header:"Date",render:r=>r.invoice_date},{key:"amount",header:"Amount",align:"right",render:r=>money(Number(r.total_amount))},
        {key:"status",header:"Status",render:r=><StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge>},{key:"action",header:"Open",render:r=><Link className="button" href={`/sales/invoices/${r.id}`}>View</Link>}
      ]} empty="No sales linked to this contact." />
    </PageSection>
    <PageSection title="Purchases" description="Documents linked to this contact.">
      <DataTable rows={activity.purchases} columns={[
        {key:"number",header:"Invoice",render:r=>r.invoice_id??r.id},{key:"date",header:"Date",render:r=>r.invoice_date},{key:"amount",header:"Amount",render:r=>money(Number(r.total_amount))},
        {key:"status",header:"Status",render:r=><StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge>},{key:"action",header:"Open",render:r=><Link className="button" href={`/purchase/invoices/${r.id}`}>View</Link>}
      ]} empty="No purchases linked to this contact." />
    </PageSection>
    <PageSection title="Payments" description="Payments recorded against this contact.">
      <DataTable rows={activity.payments} columns={[
        {key:"number",header:"Payment",render:r=>r.payment_number??r.id},{key:"date",header:"Date",render:r=>r.payment_date},{key:"type",header:"Type",render:r=>r.payment_type},{key:"amount",header:"Amount",align:"right",render:r=>money(Number(r.amount))},
        {key:"status",header:"Status",render:r=><StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge>},{key:"action",header:"Open",render:r=><Link className="button" href={`/accounting/transactions/payments/${r.id}`}>View</Link>}
      ]} empty="No payments linked to this contact." />
    </PageSection>
    <PageSection title="Expenses" description="Expenses recorded against this contact.">
      <DataTable rows={activity.expenses} columns={[
        {key:"number",header:"Expense",render:r=>r.expense_number??r.id},{key:"date",header:"Date",render:r=>r.expense_date},{key:"amount",header:"Amount",render:r=>money(Number(r.amount))},{key:"status",header:"Status",render:r=><StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge>}
      ]} empty="No expenses linked to this contact." />
    </PageSection>
  </div>;
}