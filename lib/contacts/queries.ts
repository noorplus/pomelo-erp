import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";

export async function listContacts(s: TypedSupabaseClient, org: string) {
  const { data, error } = await s.from("contacts").select("*").eq("organization_id", org).order("name");
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load contacts.");
  return data;
}

export async function getContact(s: TypedSupabaseClient, org: string, id: string) {
  const [contact, sales, purchases, payments, expenses] = await Promise.all([
    s.from("contacts").select("*").eq("organization_id", org).eq("id", id).maybeSingle(),
    s.from("sales").select("id,invoice_id,invoice_date,total_amount,status").eq("organization_id", org).eq("customer_id", id).order("invoice_date", { ascending: false }),
    s.from("purchase").select("id,invoice_id,invoice_date,total_amount,status").eq("organization_id", org).eq("supplier_id", id).order("invoice_date", { ascending: false }),
    s.from("payments").select("id,payment_number,payment_date,payment_type,amount,status").eq("organization_id", org).eq("contact_id", id).order("payment_date", { ascending: false }),
    s.from("expenses").select("id,expense_number,expense_date,amount,status").eq("organization_id", org).eq("contact_id", id).order("expense_date", { ascending: false }),
  ]);
  for (const result of [contact, sales, purchases, payments, expenses]) {
    if (result.error) throwSupabaseError(result.error, "DATABASE_ERROR", "Unable to load contact activity.");
  }
  const saleRows = sales.data ?? [];
  const purchaseRows = purchases.data ?? [];
  const paymentRows = payments.data ?? [];
  const expenseRows = expenses.data ?? [];
  const paymentIds = paymentRows.map((row) => row.id);
  const allocations = paymentIds.length
    ? await s.from("payment_allocations").select("id,payment_id,document_id,allocated_amount").eq("organization_id", org).in("payment_id", paymentIds)
    : { data: [], error: null };
  if (allocations.error) throwSupabaseError(allocations.error, "DATABASE_ERROR", "Unable to load contact payment allocations.");
  const allocationRows = allocations.data ?? [];
  return {
    contact: contact.data,
    activity: {
      sales: saleRows, purchases: purchaseRows, payments: paymentRows, expenses: expenseRows, allocations: allocationRows,
      confirmedSales: saleRows.filter((row) => row.status === "CONFIRMED").reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0),
      confirmedPurchases: purchaseRows.filter((row) => row.status === "CONFIRMED").reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0),
      confirmedPayments: paymentRows.filter((row) => row.status === "CONFIRMED").reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
      confirmedExpenses: expenseRows.filter((row) => row.status === "CONFIRMED").reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
      allocatedPayments: allocationRows.reduce((sum, row) => sum + Number(row.allocated_amount ?? 0), 0),
    },
  };
}