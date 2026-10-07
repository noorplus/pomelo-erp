import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";

export async function listProducts(s: TypedSupabaseClient, org: string) {
  const { data, error } = await s.from("products").select("*").eq("organization_id", org).order("name");
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load products.");
  return data;
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
