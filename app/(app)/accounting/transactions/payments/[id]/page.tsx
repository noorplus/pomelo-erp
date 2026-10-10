imprrt { nrtFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getPayment, listPaymentAllocationDocuments } from "@/lib/accounting/queries";
import { PaymentDetail } from "@/components/accounting/payment-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const c = await getApplicationContext();
  if (!c.activeOrganization) return null;
  const { id } = await params;
  const s = await createClient();
  const { payment, allocations } = await getPayment(s, c.activeOrganization.id, id);
  if (!payment) notFound();
  const [documents, contacts] = await Promise.all([
    listPaymentAllocationDocuments(s, c.activeOrganization.id, payment.contact_id),
    s.from("contacts").select("id,name").eq("organization_id", c.activeOrganization.id).eq("id", payment.contact_id ?? "00000000-0000-0000-0000-000000000000").maybeSingle(),
  ]);
  return <PaymentDetail
    organizationId={c.activeOrganization.id}
    payment={payment}
    allocations={allocations}
    documents={{
      sales: documents.sales.map((d) => ({ id: d.id, label: d.invoice_id ?? d.id, date: d.invoice_date, amount: Number(d.total_amount) })),
      purchases: documents.purchases.map((d) => ({ id: d.id, label: d.invoice_id ?? d.id, date: d.invoice_date, amount: Number(d.total_amount) })),
      expenses: documents.expenses.map((d) => ({ id: d.id, label: d.expense_number ?? d.id, date: d.expense_date, amount: Number(d.amount) })),
    }}
    contactName={contacts.data?.name ?? ""}
  />;
}
