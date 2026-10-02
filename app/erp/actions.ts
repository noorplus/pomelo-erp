"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
type Json = any;
import { getCurrentOrganization } from "@/lib/supabase/organization";

import type { ActionState } from "@/lib/erp/types";

const s = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const n = (fd: FormData, key: string) => Number(fd.get(key) ?? 0);
const json = <T,>(fd: FormData, key: string): T[] => {
  try { return JSON.parse(s(fd, key) || "[]") as T[]; } catch { return []; }
};
const dbError = (error: { code?: string; message?: string }) => {
  if (error.code === "23505") return "A record with the same value already exists.";
  if (error.code === "23503") return "A selected record is invalid or is already referenced by another record.";
  if (error.code === "23514") return error.message || "A database business rule was not satisfied.";
  if (error.code === "42501") return "You do not have permission for this operation.";
  return error.message || "The operation failed.";
};
const fail = (e: unknown): ActionState => ({ error: e instanceof Error ? e.message : "The operation failed." });
const num = (v: number) => Math.round(v * 1e8) / 1e8;

export async function saveProduct(fd: FormData): Promise<ActionState> {
  try {
    const supabase: any = await createClient(), org = await getCurrentOrganization(), id = s(fd, "id");
    const productCode = s(fd, "product_code");
    const payload = {
      organization_id: org.id,
      product_code: productCode || "AUTO",
      name: s(fd, "name"),
      description: s(fd, "description") || null,
      unit_id: s(fd, "unit_id"),
      inventory_account_id: s(fd, "inventory_account_id"),
      sales_account_id: s(fd, "sales_account_id"),
      cogs_account_id: s(fd, "cogs_account_id"),
      is_active: fd.get("is_active") === "true",
    };
    if (!payload.name || !payload.unit_id || !payload.inventory_account_id || !payload.sales_account_id || !payload.cogs_account_id)
      return { error: "Name, unit and all three product accounts are required." };
    const q = id
      ? await supabase.from("products").update(productCode ? payload : { ...payload, product_code: undefined }).eq("organization_id", org.id).eq("id", id)
      : await supabase.from("products").insert(payload);
    if (q.error) return { error: dbError(q.error) };
    revalidatePath("/products"); revalidatePath("/inventory");
    return { success: id ? "Product updated." : "Product created." };
  } catch (e) { return fail(e); }
}

export async function toggleProduct(fd: FormData): Promise<ActionState> {
  try {
    const supabase: any = await createClient(), org = await getCurrentOrganization();
    const id = s(fd, "id"), next = fd.get("next_active") === "true";
    const { error } = await supabase.from("products").update({ is_active: next }).eq("organization_id", org.id).eq("id", id);
    if (error) return { error: dbError(error) };
    revalidatePath("/products"); return { success: next ? "Product activated." : "Product deactivated." };
  } catch (e) { return fail(e); }
}

export async function saveContact(fd: FormData): Promise<ActionState> {
  try {
    const supabase: any = await createClient(), org = await getCurrentOrganization(), id = s(fd, "id");
    const contactNumber = s(fd, "contact_number");
    const payload = {
      organization_id: org.id, contact_number: contactNumber || "AUTO",
      name: s(fd, "name"), phone: s(fd, "phone") || null, email: s(fd, "email") || null,
      address: s(fd, "address") || null, is_active: fd.get("is_active") === "true",
    };
    if (!payload.name) return { error: "Contact name is required." };
    const q = id
      ? await supabase.from("contacts").update(contactNumber ? payload : { ...payload, contact_number: undefined }).eq("organization_id", org.id).eq("id", id)
      : await supabase.from("contacts").insert(payload);
    if (q.error) return { error: dbError(q.error) };
    revalidatePath("/contacts"); revalidatePath("/sales"); revalidatePath("/purchases"); revalidatePath("/payments");
    return { success: id ? "Contact updated." : "Contact created." };
  } catch (e) { return fail(e); }
}

export async function toggleContact(fd: FormData): Promise<ActionState> {
  try {
    const supabase: any = await createClient(), org = await getCurrentOrganization();
    const id = s(fd, "id"), next = fd.get("next_active") === "true";
    const { error } = await supabase.from("contacts").update({ is_active: next }).eq("organization_id", org.id).eq("id", id);
    if (error) return { error: dbError(error) };
    revalidatePath("/contacts"); return { success: next ? "Contact activated." : "Contact deactivated." };
  } catch (e) { return fail(e); }
}

type InvoiceLine = { product_id: string; quantity: number; unit_price?: number; unit_cost?: number; original_item_id?: string };

async function createInvoice(fd: FormData, kind: "purchase" | "sale"): Promise<ActionState> {
  try {
    const supabase: any = await createClient(), org = await getCurrentOrganization();
    const type = s(fd, "document_type") as "purchase" | "sale" | "return";
    const originalInvoiceId = s(fd, "original_invoice_id") || null;
    const contactId = s(fd, kind === "purchase" ? "supplier_id" : "customer_id");
    const accountId = s(fd, kind === "purchase" ? "payable_account_id" : "receivable_account_id");
    const date = s(fd, "invoice_date");
    let lines = json<InvoiceLine>(fd, "items_json");
    if (!contactId || !accountId || !date || !lines.length) return { error: "Contact, posting account, date and at least one line are required." };
    if (type === "return" && !originalInvoiceId) return { error: "A posted original invoice is required for a return." };

    let originalItems: Record<string, any> = {};
    if (type === "return") {
      const table = kind === "purchase" ? "purchase_items" : "sales_items";
      const invoiceCol = kind === "purchase" ? "purchase_invoice_id" : "sales_invoice_id";
      const { data: originals, error } = await supabase.from(table).select("*").eq("organization_id", org.id).eq(invoiceCol, originalInvoiceId);
      if (error) return { error: dbError(error) };
      originalItems = Object.fromEntries((originals ?? []).map((x: any) => [x.id, x]));
      if (!Object.keys(originalItems).length) return { error: "The selected original invoice has no lines." };
      lines = lines.map(line => {
        const original = originalItems[line.original_item_id || ""];
        if (!original) throw new Error("Every return line must reference a line from the selected original invoice.");
        return kind === "purchase"
          ? { product_id: original.product_id, quantity: Number(line.quantity), unit_cost: Number(original.net_unit_cost), original_item_id: original.id }
          : { product_id: original.product_id, quantity: Number(line.quantity), unit_price: Number(original.net_unit_price), original_item_id: original.id };
      });
    }

    const clean = lines.map(x => ({
      product_id: x.product_id, quantity: Number(x.quantity),
      unit: Number(kind === "purchase" ? x.unit_cost : x.unit_price),
      original_item_id: x.original_item_id || null,
    }));
    if (clean.some(x => !x.product_id || x.quantity <= 0 || x.unit < 0)) return { error: "Every line must have a valid product, positive quantity and non-negative price/cost." };

    const subtotal = num(clean.reduce((a, x) => a + x.quantity * x.unit, 0));
    const discount = type === "return" ? 0 : num(Math.max(0, Number(fd.get("discount_amount") ?? 0)));
    if (discount > subtotal) return { error: "Invoice discount cannot exceed subtotal." };
    const totalQty = clean.reduce((a, x) => a + x.quantity, 0);
    const discountPerUnit = totalQty ? discount / totalQty : 0;
    const total = num(subtotal - discount);

    const invoiceTable = kind === "purchase" ? "purchase_invoices" : "sales_invoices";
    const db = supabase as any;
    const invoicePayload: any = {
      organization_id: org.id, document_type: type, original_invoice_id: type === "return" ? originalInvoiceId : null,
      [kind === "purchase" ? "supplier_id" : "customer_id"]: contactId,
      invoice_date: date, subtotal, discount_amount: discount, total_amount: total,
      [kind === "purchase" ? "payable_account_id" : "receivable_account_id"]: accountId, status: "draft",
    };
    const { data: invoice, error: invoiceError } = await db.from(invoiceTable).insert(invoicePayload).select("id").single();
    if (invoiceError || !invoice) return { error: dbError(invoiceError ?? { message: "Unable to create invoice." }) };

    const itemTable = kind === "purchase" ? "purchase_items" : "sales_items";
    const itemRows = clean.map((x, i) => kind === "purchase"
      ? { organization_id: org.id, purchase_invoice_id: invoice.id, line_number: i + 1, product_id: x.product_id, original_item_id: x.original_item_id, quantity: x.quantity, unit_cost: x.unit, discount_per_unit: discountPerUnit, net_unit_cost: num(x.unit - discountPerUnit), line_total: num((x.unit - discountPerUnit) * x.quantity) }
      : { organization_id: org.id, sales_invoice_id: invoice.id, line_number: i + 1, product_id: x.product_id, original_item_id: x.original_item_id, quantity: x.quantity, unit_price: x.unit, discount_per_unit: discountPerUnit, net_unit_price: num(x.unit - discountPerUnit), line_total: num((x.unit - discountPerUnit) * x.quantity), cogs_unit_cost: null, cogs_total: null });

    const { error: itemError } = await db.from(itemTable).insert(itemRows);
    if (itemError) {
      await db.from(invoiceTable).delete().eq("organization_id", org.id).eq("id", invoice.id);
      return { error: dbError(itemError) };
    }
    revalidatePath(kind === "purchase" ? "/purchases" : "/sales");
    return { success: type === "return" ? "Return draft created." : "Invoice draft created." };
  } catch (e) { return fail(e); }
}

export async function createPurchaseInvoice(fd: FormData) { return createInvoice(fd, "purchase"); }
export async function createSalesInvoice(fd: FormData) { return createInvoice(fd, "sale"); }

export async function postPurchase(fd: FormData): Promise<ActionState> {
  try {
    const supabase: any = await createClient(), id = s(fd, "id"), account = s(fd, "account_id");
    const { error } = await supabase.rpc("post_purchase_invoice", { p_invoice_id: id, p_payable_account_id: account });
    if (error) return { error: dbError(error) };
    revalidatePath("/purchases"); revalidatePath("/inventory"); revalidatePath("/accounting"); revalidatePath("/payments");
    return { success: "Purchase posted successfully." };
  } catch (e) { return fail(e); }
}

export async function postSales(fd: FormData): Promise<ActionState> {
  try {
    const supabase: any = await createClient(), id = s(fd, "id"), account = s(fd, "account_id");
    const { error } = await supabase.rpc("post_sales_invoice", { p_invoice_id: id, p_receivable_account_id: account });
    if (error) return { error: dbError(error) };
    revalidatePath("/sales"); revalidatePath("/inventory"); revalidatePath("/accounting"); revalidatePath("/payments");
    return { success: "Sales invoice posted successfully." };
  } catch (e) { return fail(e); }
}

export async function createAndPostExpense(fd: FormData): Promise<ActionState> {
  try {
    const supabase: any = await createClient(), org = await getCurrentOrganization();
    const payload = {
      organization_id: org.id, expense_category_id: s(fd, "expense_category_id"), contact_id: s(fd, "contact_id") || null,
      payable_account_id: s(fd, "payable_account_id"), expense_date: s(fd, "expense_date"),
      amount: n(fd, "amount"), description: s(fd, "description") || null, status: "draft",
    };
    if (!payload.expense_category_id || !payload.payable_account_id || !payload.expense_date || payload.amount <= 0) return { error: "Category, payable account, date and a positive amount are required." };
    const { data: expense, error } = await supabase.from("expenses").insert(payload).select("id").single();
    if (error || !expense) return { error: dbError(error ?? { message: "Unable to create expense." }) };
    const { error: postError } = await supabase.rpc("post_expense", { p_expense_id: expense.id, p_credit_account_id: payload.payable_account_id });
    if (postError) return { error: dbError(postError) };
    revalidatePath("/expenses"); revalidatePath("/accounting"); revalidatePath("/payments");
    return { success: "Expense posted successfully." };
  } catch (e) { return fail(e); }
}

export async function createAndPostPayment(fd: FormData): Promise<ActionState> {
  try {
    const supabase: any = await createClient(), org = await getCurrentOrganization();
    const type = s(fd, "payment_type");
    const payload = {
      organization_id: org.id, payment_type: type, contact_id: s(fd, "contact_id") || null,
      payment_date: s(fd, "payment_date"), amount: n(fd, "amount"), account_id: s(fd, "account_id"),
      settlement_account_id: s(fd, "settlement_account_id"), description: s(fd, "description") || null, status: "draft",
    };
    if (!["receipt","payment","refund_in","refund_out"].includes(type) || !payload.payment_date || payload.amount <= 0 || !payload.account_id || !payload.settlement_account_id || !payload.contact_id)
      return { error: "Payment type, contact, date, amount, cash/bank account and settlement account are required." };
    const { data: payment, error } = await supabase.from("payments").insert(payload).select("id").single();
    if (error || !payment) return { error: dbError(error ?? { message: "Unable to create payment." }) };
    const allocations = json<{document_type:string;document_id:string;allocated_amount:number}>(fd, "allocations_json").filter(x => x.document_id && x.allocated_amount > 0);
    const { error: postError } = await supabase.rpc("post_payment", { p_payment_id: payment.id, p_settlement_account_id: payload.settlement_account_id, p_allocations: allocations as Json });
    if (postError) return { error: dbError(postError) };
    revalidatePath("/payments"); revalidatePath("/accounting"); return { success: "Payment posted successfully." };
  } catch (e) { return fail(e); }
}

export async function postManualJournal(fd: FormData): Promise<ActionState> {
  try {
    const supabase: any = await createClient(), org = await getCurrentOrganization();
    const lines = json<{account_id:string;debit:number;credit:number;description?:string;contact_id?:string}>(fd, "lines_json");
    if (lines.length < 2) return { error: "A journal requires at least two lines." };
    const debit = num(lines.reduce((a,x)=>a+Number(x.debit||0),0)), credit = num(lines.reduce((a,x)=>a+Number(x.credit||0),0));
    if (debit <= 0 || debit !== credit) return { error: "Journal debits and credits must be equal and greater than zero." };
    const { error } = await supabase.rpc("post_manual_journal", {
      p_org_id: org.id, p_entry_date: s(fd,"entry_date"), p_description: s(fd,"description"),
      p_entry_type: "manual", p_lines: lines as Json,
    });
    if (error) return { error: dbError(error) };
    revalidatePath("/accounting"); revalidatePath("/reports"); return { success: "Journal posted successfully." };
  } catch (e) { return fail(e); }
}

export async function reverseJournal(fd: FormData): Promise<ActionState> {
  try {
    const supabase: any = await createClient();
    const { error } = await supabase.rpc("reverse_journal", { p_journal_id: s(fd,"id"), p_reversal_date: s(fd,"reversal_date"), p_description: s(fd,"description") || null });
    if (error) return { error: dbError(error) };
    revalidatePath("/accounting"); revalidatePath("/reports"); return { success: "Journal reversed successfully." };
  } catch (e) { return fail(e); }
}


export async function updateOrganizationUser(fd: FormData): Promise<ActionState> {
  try {
    const supabase: any = await createClient(), org = await getCurrentOrganization();
    const id = s(fd, "id"), role = s(fd, "role");
    const active = fd.get("is_active") === "true";
    if (!id || !["owner","admin","manager","staff"].includes(role)) return { error: "A valid member and role are required." };
    const { error } = await supabase.from("organization_users").update({ role, is_active: active }).eq("organization_id", org.id).eq("id", id);
    if (error) return { error: dbError(error) };
    revalidatePath("/settings/users"); revalidatePath("/settings");
    return { success: "Membership updated." };
  } catch (e) { return fail(e); }
}
