import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";

export async function listSales(s: TypedSupabaseClient, org: string) {
  const { data, error } = await s.from("sales").select("*").eq("organization_id", org).order("invoice_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load sales.");
  const customerIds = [...new Set(data.map((x) => x.customer_id))];
  const customers = customerIds.length ? await s.from("contacts").select("id,name,contact_number").eq("organization_id", org).in("id", customerIds) : { data: [], error: null };
  if (customers.error) throwSupabaseError(customers.error, "DATABASE_ERROR", "Unable to load customers.");
  const map = new Map((customers.data ?? []).map((x) => [x.id, x]));
  return data.map((x) => ({ ...x, customer: map.get(x.customer_id) ?? null }));
}

export async function getSalesFormOptions(s: TypedSupabaseClient, org: string) {
  const [customers, accounts, products] = await Promise.all([
    s.from("contacts").select("id,name,contact_number").eq("organization_id", org).eq("is_active", true).order("name"),
    s.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id", org).eq("is_active", true).eq("is_postable", true).eq("account_type", "ASSET").order("account_code"),
    s.from("products").select("id,product_code,name,unit_id,is_active").eq("organization_id", org).eq("is_active", true).order("name"),
  ]);
  if (customers.error || accounts.error || products.error) throwSupabaseError(customers.error ?? accounts.error ?? products.error, "DATABASE_ERROR", "Unable to load Sales form options.");
  return { customers: customers.data, accounts: accounts.data, products: products.data };
}

export async function getSale(s: TypedSupabaseClient, org: string, id: string) {
  const [sale, items] = await Promise.all([
    s.from("sales").select("*").eq("organization_id", org).eq("id", id).single(),
    s.from("sales_items").select("*").eq("organization_id", org).eq("sales_id", id).order("line_number"),
  ]);
  if (sale.error) throwSupabaseError(sale.error, "DATABASE_ERROR", "Sales document not found.");
  if (items.error) throwSupabaseError(items.error, "DATABASE_ERROR", "Unable to load sales items.");
  const [customer, account, productRows] = await Promise.all([
    s.from("contacts").select("id,name,contact_number,phone,email,address").eq("organization_id", org).eq("id", sale.data.customer_id).single(),
    s.from("accounts").select("id,account_code,account_name").eq("organization_id", org).eq("id", sale.data.receivable_account_id).single(),
    items.data.length ? s.from("products").select("id,product_code,name").eq("organization_id", org).in("id", items.data.map((x) => x.product_id)) : { data: [], error: null },
  ]);
  if (customer.error || account.error || productRows.error) throwSupabaseError(customer.error ?? account.error ?? productRows.error, "DATABASE_ERROR", "Unable to load sales references.");
  const products = new Map((productRows.data ?? []).map((x) => [x.id, x]));
  return { ...sale.data, customer: customer.data, account: account.data, items: items.data.map((x) => ({ ...x, product: products.get(x.product_id) ?? null })) };
}

export async function listSalesReturns(s: TypedSupabaseClient, org: string) {
  const { data, error } = await s.from("sales_returns").select("*").eq("organization_id", org).order("return_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load sales returns.");
  const ids = [...new Set(data.flatMap((x) => [x.customer_id, x.sales_id]))];
  const [contacts, sales] = await Promise.all([
    data.length ? s.from("contacts").select("id,name,contact_number").eq("organization_id", org).in("id", ids.filter((x) => data.some((d) => d.customer_id === x))) : { data: [], error: null },
    data.length ? s.from("sales").select("id,invoice_id,customer_id").eq("organization_id", org).in("id", data.map((x) => x.sales_id)) : { data: [], error: null },
  ]);
  if (contacts.error || sales.error) throwSupabaseError(contacts.error ?? sales.error, "DATABASE_ERROR", "Unable to load return references.");
  const cm = new Map((contacts.data ?? []).map((x) => [x.id, x]));
  const sm = new Map((sales.data ?? []).map((x) => [x.id, x]));
  return data.map((x) => ({ ...x, customer: cm.get(x.customer_id) ?? null, sale: sm.get(x.sales_id) ?? null }));
}

export async function getSalesReturnFormOptions(s: TypedSupabaseClient, org: string) {
  const [sales, accounts] = await Promise.all([
    s.from("sales").select("id,invoice_id,customer_id,invoice_date,total_amount").eq("organization_id", org).eq("status", "CONFIRMED").order("invoice_date", { ascending: false }),
    s.from("accounts").select("id,account_code,account_name").eq("organization_id", org).eq("is_active", true).eq("is_postable", true).eq("account_type", "ASSET").order("account_code"),
  ]);
  if (sales.error || accounts.error) throwSupabaseError(sales.error ?? accounts.error, "DATABASE_ERROR", "Unable to load return options.");
  const customerIds = [...new Set(sales.data.map((x) => x.customer_id))];
  const customers = customerIds.length ? await s.from("contacts").select("id,name,contact_number").eq("organization_id", org).in("id", customerIds) : { data: [], error: null };
  if (customers.error) throwSupabaseError(customers.error, "DATABASE_ERROR", "Unable to load return customers.");
  const saleIds = sales.data.map((x) => x.id);
  const items = saleIds.length ? await s.from("sales_items").select("id,sales_id,line_number,product_id,quantity,unit_price,cogs_unit_cost").eq("organization_id", org).in("sales_id", saleIds).order("line_number") : { data: [], error: null };
  if (items.error) throwSupabaseError(items.error, "DATABASE_ERROR", "Unable to load sale items.");
  const productIds = [...new Set((items.data ?? []).map((x) => x.product_id))];
  const products = productIds.length ? await s.from("products").select("id,product_code,name").eq("organization_id", org).in("id", productIds) : { data: [], error: null };
  if (products.error) throwSupabaseError(products.error, "DATABASE_ERROR", "Unable to load products.");
  const cm = new Map((customers.data ?? []).map((x) => [x.id, x]));
  const pm = new Map((products.data ?? []).map((x) => [x.id, x]));
  return {
    accounts: accounts.data,
    sales: sales.data.map((x) => ({ ...x, customer: cm.get(x.customer_id) ?? null, items: (items.data ?? []).filter((i) => i.sales_id === x.id).map((i) => ({ ...i, product: pm.get(i.product_id) ?? null })) })),
  };
}

export async function getSalesReturn(s: TypedSupabaseClient, org: string, id: string) {
  const { data: ret, error } = await s.from("sales_returns").select("*").eq("organization_id", org).eq("id", id).single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Sales return not found.");
  const items = await s.from("sales_return_items").select("*").eq("organization_id", org).eq("sales_return_id", id).order("line_number");
  if (items.error) throwSupabaseError(items.error, "DATABASE_ERROR", "Unable to load return items.");
  const [customer, sale, products] = await Promise.all([
    s.from("contacts").select("id,name,contact_number").eq("organization_id", org).eq("id", ret.customer_id).single(),
    s.from("sales").select("id,invoice_id,invoice_date").eq("organization_id", org).eq("id", ret.sales_id).single(),
    items.data.length ? s.from("products").select("id,product_code,name").eq("organization_id", org).in("id", items.data.map((x) => x.product_id)) : { data: [], error: null },
  ]);
  if (customer.error || sale.error || products.error) throwSupabaseError(customer.error ?? sale.error ?? products.error, "DATABASE_ERROR", "Unable to load return references.");
  const pm = new Map((products.data ?? []).map((x) => [x.id, x]));
  return { ...ret, customer: customer.data, sale: sale.data, items: items.data.map((x) => ({ ...x, product: pm.get(x.product_id) ?? null })) };
}

export async function getSalesDashboard(s: TypedSupabaseClient, org: string) {
  const [sales, returns] = await Promise.all([
    s.from("sales").select("id,total_amount,status,invoice_date,customer_id").eq("organization_id", org),
    s.from("sales_returns").select("id,total_amount,status,return_date").eq("organization_id", org),
  ]);
  if (sales.error || returns.error) throwSupabaseError(sales.error ?? returns.error, "DATABASE_ERROR", "Unable to load Sales dashboard.");
  const confirmed = sales.data.filter((x) => x.status === "CONFIRMED");
  const drafts = sales.data.filter((x) => x.status === "DRAFT");
  const confirmedReturns = returns.data.filter((x) => x.status === "CONFIRMED");
  return {
    invoiceCount: confirmed.length,
    invoiceTotal: confirmed.reduce((n, x) => n + Number(x.total_amount), 0),
    draftCount: drafts.length,
    returnCount: confirmedReturns.length,
    returnTotal: confirmedReturns.reduce((n, x) => n + Number(x.total_amount), 0),
    recent: sales.data.sort((a, b) => String(b.invoice_date).localeCompare(String(a.invoice_date))).slice(0, 8),
  };
}
