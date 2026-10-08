import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";

export async function listProducts(s: TypedSupabaseClient, org: string) {
  const { data, error } = await s.from("products").select("*").eq("organization_id", org).order("name");
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load products.");
  return data;
}

export async function getProduct(s: TypedSupabaseClient, org: string, id: string) {
  const { data, error } = await s.from("products").select("*").eq("organization_id", org).eq("id", id).maybeSingle();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load the product.");
  return data;
}

export async function getProductDetails(s: TypedSupabaseClient, org: string, id: string) {
  const product = await getProduct(s, org, id);
  if (!product) return null;

  const [unit, inventory, inventoryAccount, salesAccount, cogsAccount, purchases, sales, purchaseReturns, salesReturns] = await Promise.all([
    s.from("units_of_measure").select("id,name,is_active").eq("organization_id", org).eq("id", product.unit_id).maybeSingle(),
    s.from("inventory_balances").select("*").eq("organization_id", org).eq("product_id", product.id).maybeSingle(),
    s.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id", org).eq("id", product.inventory_account_id).maybeSingle(),
    s.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id", org).eq("id", product.sales_account_id).maybeSingle(),
    s.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id", org).eq("id", product.cogs_account_id).maybeSingle(),
    s.from("purchase_items").select("id,purchase_id,quantity,unit_cost,line_total,purchase!inner(invoice_id,invoice_date,status,supplier_id)").eq("organization_id", org).eq("product_id", product.id).order("created_at", { ascending: false }),
    s.from("sales_items").select("id,sales_id,quantity,unit_price,line_total,cogs_unit_cost,cogs_total,sales!inner(invoice_id,invoice_date,status,customer_id)").eq("organization_id", org).eq("product_id", product.id).order("created_at", { ascending: false }),
    s.from("purchase_return_items").select("id,purchase_return_id,quantity,unit_cost,line_total,purchase_returns!inner(return_number,return_date,status,supplier_id)").eq("organization_id", org).eq("product_id", product.id).order("created_at", { ascending: false }),
    s.from("sales_return_items").select("id,sales_return_id,quantity,unit_price,line_total,cogs_unit_cost,cogs_total,sales_returns!inner(return_number,return_date,status,customer_id)").eq("organization_id", org).eq("product_id", product.id).order("created_at", { ascending: false }),
  ]);

  for (const result of [unit, inventory, inventoryAccount, salesAccount, cogsAccount, purchases, sales, purchaseReturns, salesReturns]) {
    if (result.error) throwSupabaseError(result.error, "DATABASE_ERROR", "Unable to load product details.");
  }

  return {
    product,
    unit: unit.data,
    inventory: inventory.data,
    inventoryAccount: inventoryAccount.data,
    salesAccount: salesAccount.data,
    cogsAccount: cogsAccount.data,
    activity: {
      purchases: purchases.data ?? [],
      sales: sales.data ?? [],
      purchaseReturns: purchaseReturns.data ?? [],
      salesReturns: salesReturns.data ?? [],
    },
  };
}

export async function listProductFormOptions(s: TypedSupabaseClient, org: string) {
  const [units, inventoryAccounts, salesAccounts, cogsAccounts] = await Promise.all([
    s.from("units_of_measure").select("id,name,is_active").eq("organization_id", org).eq("is_active", true).order("name"),
    s.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id", org).eq("is_active", true).eq("is_postable", true).eq("account_type", "ASSET").order("account_code"),
    s.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id", org).eq("is_active", true).eq("is_postable", true).eq("account_type", "REVENUE").order("account_code"),
    s.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id", org).eq("is_active", true).eq("is_postable", true).eq("account_type", "EXPENSE").order("account_code"),
  ]);
  if (units.error) throwSupabaseError(units.error, "DATABASE_ERROR", "Unable to load product units.");
  if (inventoryAccounts.error || salesAccounts.error || cogsAccounts.error) {
    throwSupabaseError(inventoryAccounts.error ?? salesAccounts.error ?? cogsAccounts.error, "DATABASE_ERROR", "Unable to load product accounting accounts.");
  }
  return { units: units.data, inventoryAccounts: inventoryAccounts.data, salesAccounts: salesAccounts.data, cogsAccounts: cogsAccounts.data };
}