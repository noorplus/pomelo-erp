import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";

export async function listAccountingPeriods(supabase: TypedSupabaseClient, organizationId: string) {
  const { data, error } = await supabase.from("accounting_periods").select("*").eq("organization_id", organizationId).order("start_date", { ascending: false });
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load accounting periods.");
  return data;
}

export async function listAccounts(supabase: TypedSupabaseClient, organizationId: string) {
  const { data, error } = await supabase.from("accounts").select("*").eq("organization_id", organizationId).order("account_code", { ascending: true });
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load chart of accounts.");
  return data;
}
