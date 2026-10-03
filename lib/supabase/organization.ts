import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type CurrentOrganization = {
  id: string;
  name: string;
  role: "owner" | "admin" | "manager" | "staff";
  base_currency: string;
  timezone: string;
};

async function loadOrganization(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  preferredOrganizationId?: string,
) {
  let query = supabase
    .from("organization_users")
    .select("organization_id, role, organizations!inner(id, name, base_currency, timezone)")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (preferredOrganizationId) query = query.eq("organization_id", preferredOrganizationId);
  return query.limit(1).maybeSingle();
}

export async function findCurrentOrganization(): Promise<CurrentOrganization | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const preferredOrganizationId = cookieStore.get("pomelo_org_id")?.value;

  let { data, error } = await loadOrganization(supabase, user.id, preferredOrganizationId);

  if (error || !data) {
    if (preferredOrganizationId) {
      const fallback = await loadOrganization(supabase, user.id);
      data = fallback.data;
      error = fallback.error;
    }
    if (error || !data) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session?.user) {
        const retry = await loadOrganization(supabase, refreshed.session.user.id);
        data = retry.data;
        error = retry.error;
      }
    }
  }

  if (error || !data) return null;
  const organization = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  if (!organization) return null;

  return {
    id: data.organization_id,
    name: organization.name,
    role: data.role,
    base_currency: organization.base_currency,
    timezone: organization.timezone,
  };
}

export async function getCurrentOrganization(): Promise<CurrentOrganization> {
  const organization = await findCurrentOrganization();
  if (!organization) throw new Error("No active organization is assigned to your account.");
  return organization;
}

export async function getCurrentUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");
  return user.id;
}
