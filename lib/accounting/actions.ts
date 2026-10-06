import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database";

type AccountInsert = Omit<TablesInsert<"accounts">, "organization_id">;
type AccountUpdate = Omit<TablesUpdate<"accounts">, "organization_id">;

export async function createAccountingPeriod(
  supabase: TypedSupabaseClient,
  input: { organizationId: string; name: string; startDate: string; endDate: string },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_accounting_period", {
    p_organization_id: input.organizationId,
    p_name: input.name,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
  });
  if (error) throwSupabaseError(error, "RPC_ERROR", "Unable to create the accounting period.");
  return data;
}

export async function closeAccountingPeriod(supabase: TypedSupabaseClient, periodId: string): Promise<void> {
  const { error } = await supabase.rpc("close_accounting_period", { p_period_id: periodId });
  if (error) throwSupabaseError(error, "RPC_ERROR", "Unable to close the accounting period.");
}

export async function createAccount(
  supabase: TypedSupabaseClient,
  organizationId: string,
  input: AccountInsert,
): Promise<string> {
  const { data, error } = await supabase.from("accounts").insert({ ...input, organization_id: organizationId }).select("id").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the account.");
  return data.id;
}

export async function updateAccount(
  supabase: TypedSupabaseClient,
  organizationId: string,
  accountId: string,
  input: AccountUpdate,
): Promise<void> {
  const { data: existing, error: lookupError } = await supabase.from("accounts").select("is_system_account").eq("organization_id", organizationId).eq("id", accountId).single();
  if (lookupError) throwSupabaseError(lookupError, "DATABASE_ERROR", "Unable to load the account.");
  if (existing.is_system_account) throw new Error("System accounts are managed by the ERP and cannot be edited here.");
  const { error } = await supabase.from("accounts").update(input).eq("organization_id", organizationId).eq("id", accountId);
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to update the account.");
}

export async function deactivateAccount(
  supabase: TypedSupabaseClient,
  organizationId: string,
  accountId: string,
): Promise<void> {
  await updateAccount(supabase, organizationId, accountId, { is_active: false });
}
