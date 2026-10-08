import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";
import type { TablesInsert } from "@/lib/supabase/database";

export async function createSale(s: TypedSupabaseClient, org: string, userId: string, input: {
  customer_id: string; invoice_date: string; receivable_account_id: string; discount_amount: number;
  items: Array<{ product_id: string; quantity: number; unit_price: number }>;
}) {
  if (!input.items.length) throw new Error("Add at least one product.");
  const subtotal = input.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const discount = Math.max(0, Math.min(input.discount_amount, subtotal));
  const { data: sale, error } = await s.from("sales").insert({
    organization_id: org, customer_id: input.customer_id, invoice_date: input.invoice_date,
    receivable_account_id: input.receivable_account_id, subtotal, discount_amount: discount, total_amount: subtotal - discount,
    status: "DRAFT", created_by: userId,
  } satisfies TablesInsert<"sales">).select("id").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the sales draft.");
  const rows = input.items.map((i, index) => ({ organization_id: org, sales_id: sale.id, line_number: index + 1, product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, line_total: i.quantity * i.unit_price, cogs_unit_cost: 0, cogs_total: 0 })) satisfies TablesInsert<"sales_items">[];
  const { error: itemError } = await s.from("sales_items").insert(rows);
  if (itemError) { await s.from("sales").delete().eq("organization_id", org).eq("id", sale.id); throwSupabaseError(itemError, "DATABASE_ERROR", "Unable to create sales items."); }
  return sale;
}

export async function confirmSale(s: TypedSupabaseClient, id: string) { const { error } = await s.rpc("confirm_sales", { p_id: id }); if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to confirm the sale."); }
export async function cancelSale(s: TypedSupabaseClient, id: string) { const { error } = await s.rpc("cancel_sales", { p_id: id }); if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to cancel the sale."); }

export async function createSalesReturn(s: TypedSupabaseClient, org: string, userId: string, input: {
  sales_id: string; customer_id: string; return_date: string; receivable_account_id: string; discount_amount: number;
  items: Array<{ sales_item_id: string; product_id: string; quantity: number; unit_price: number }>;
}) {
  if (!input.items.length) throw new Error("Select at least one sale item.");
  const subtotal = input.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const discount = Math.max(0, Math.min(input.discount_amount, subtotal));
  const { data: ret, error } = await s.from("sales_returns").insert({
    organization_id: org, sales_id: input.sales_id, customer_id: input.customer_id, return_date: input.return_date,
    receivable_account_id: input.receivable_account_id, subtotal, discount_amount: discount, total_amount: subtotal - discount, status: "DRAFT", created_by: userId,
  } satisfies TablesInsert<"sales_returns">).select("id").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the sales return draft.");
  const rows = input.items.map((i, index) => ({ organization_id: org, sales_return_id: ret.id, line_number: index + 1, sales_item_id: i.sales_item_id, product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, line_total: i.quantity * i.unit_price, cogs_unit_cost: 0, cogs_total: 0 })) satisfies TablesInsert<"sales_return_items">[];
  const { error: itemError } = await s.from("sales_return_items").insert(rows);
  if (itemError) { await s.from("sales_returns").delete().eq("organization_id", org).eq("id", ret.id); throwSupabaseError(itemError, "DATABASE_ERROR", "Unable to create return items."); }
  return ret;
}
export async function confirmSalesReturn(s: TypedSupabaseClient, id: string) { const { error } = await s.rpc("confirm_sales_return", { p_id: id }); if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to confirm the sales return."); }
export async function cancelSalesReturn(s: TypedSupabaseClient, id: string) { const { error } = await s.rpc("cancel_sales_return", { p_id: id }); if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to cancel the sales return."); }
