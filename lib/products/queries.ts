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

  const [unit, inventory, inventoryAccount, salesAccount, cogsAccount] = await Promise.all([
    s.from("units_of_measure").select("id,name,is_active").eq("organization_id", org).eq("id", product.unit_id).maybeSingle(),
    s.from("inventory_balances").select("*").eq("organization_id", org).eq("product_id", product.id).maybeSingle(),
    s.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id", org).eq("id", product.inventory_account_id).maybeSingle(),
    s.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id", org).eq("id", product.sales_account_id).maybeSingle(),
    s.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id", org).eq("id", product.cogs_account_id).maybeSingle(),
  ]);

  for (const result of [unit, inventory, inventoryAccount, salesAccount, cogsAccount]) {
    if (result.error) throwSupabaseError(result.error, "DATABASE_ERROR", "Unable to load product details.");
  }

  return {
    product,
    unit: unit.data,
    inventory: inventory.data,
    inventoryAccount: inventoryAccount.data,
    salesAccount: salesAccount.data,
    cogsAccount: cogsAccount.data,
  };
}

export async function listProductFormOptions(s: TypedSupabaseClient, org: string) {
  const [units, accounts] = await Promise.all([
    s.from("units_of_measure").select("id,name,is_active").eq("organization_id", org).eq("is_active", true).order("name"),
    s.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id", org).eq("is_active", true).eq("is_postable", true).order("account_code"),
  ]);
  if (units.error) throwSupabaseError(units.error, "DATABASE_ERROR", "Unable to load product units.");
  if (accounts.error) throwSupabaseError(accounts.error, "DATABASE_ERROR", "Unable to load product accounts.");
  return { units: units.data, accounts: accounts.data };
}
