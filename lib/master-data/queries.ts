import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";

export async function listUnits(s: TypedSupabaseClient, org: string) {
  const { data, error } = await s.from("units_of_measure").select("*").eq("organization_id", org).order("name");
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load units of measure.");
  return data;
}
export async function listProducts(s: TypedSupabaseClient, org: string) {
  const { data, error } = await s.from("products").select("*").eq("organization_id", org).order("name");
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load products.");
  return data;
}
export async function listActiveAccounts(s: TypedSupabaseClient, org: string) {
  const { data, error } = await s.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id", org).eq("is_active", true).order("account_code");
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load accounts.");
  return data;
}
export async function listNumberSequences(s: TypedSupabaseClient, org: string) {
  const { data, error } = await s.from("number_sequences").select("*").eq("organization_id", org).order("document_type");
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load number sequences.");
  return data;
}
