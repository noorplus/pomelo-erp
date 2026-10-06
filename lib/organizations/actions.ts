import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";

export async function createOrganization(supabase: TypedSupabaseClient, input: { name: string; baseCurrency?: string; timezone?: string }): Promise<string> {
  const { data, error } = await supabase.rpc("onboard_organization", { p_name: input.name, p_base_currency: input.baseCurrency, p_timezone: input.timezone });
  if (error) throwSupabaseError(error, "RPC_ERROR", "Unable to create the organization.");
  return data;
}

export async function updateOrganization(supabase: TypedSupabaseClient, organizationId: string, input: {
  name: string; phone: string | null; email: string | null; address: string | null; city: string | null;
  country: string | null; baseCurrency: string; timezone: string; tin: string | null; bin: string | null;
}): Promise<void> {
  const { error } = await supabase.from("organizations").update({
    name: input.name, phone: input.phone, email: input.email, address: input.address, city: input.city,
    country: input.country, base_currency: input.baseCurrency, timezone: input.timezone, tin: input.tin, bin: input.bin,
  }).eq("id", organizationId);
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to update organization settings.");
}

export async function addOrganizationUserByEmail(supabase: TypedSupabaseClient, organizationId: string, email: string): Promise<string> {
  const { data, error } = await supabase.rpc("add_organization_user_by_email", { p_organization_id: organizationId, p_email: email });
  if (error) throwSupabaseError(error, "RPC_ERROR", "Unable to add the organization member.");
  return data;
}

export async function removeOrganizationUserByEmail(supabase: TypedSupabaseClient, organizationId: string, email: string): Promise<string> {
  const { data, error } = await supabase.rpc("remove_organization_user_by_email", { p_organization_id: organizationId, p_email: email });
  if (error) throwSupabaseError(error, "RPC_ERROR", "Unable to remove the organization member.");
  return data;
}

export async function addOrganizationUser(supabase: TypedSupabaseClient, organizationId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("add_organization_user", { p_organization_id: organizationId, p_user_id: userId });
  if (error) throwSupabaseError(error, "RPC_ERROR", "Unable to add the organization user.");
}

export async function removeOrganizationUser(supabase: TypedSupabaseClient, organizationId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_organization_user", { p_organization_id: organizationId, p_user_id: userId });
  if (error) throwSupabaseError(error, "RPC_ERROR", "Unable to remove the organization user.");
}
