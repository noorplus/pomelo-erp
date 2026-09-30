import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type CurrentOrganization = {
  id: string;
  name: string;
  role: "owner" | "admin" | "manager" | "staff";
};

export async function findCurrentOrganization(): Promise<CurrentOrganization | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const cookieStore = await cookies();
  const preferredOrganizationId = cookieStore.get("pomelo_org_id")?.value;

  let query = supabase
    .from("organization_users")
    .select("organization_id, role, organizations!inner(id, name)")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (preferredOrganizationId) {
    query = query.eq("organization_id", preferredOrganizationId);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error || !data) return null;

  const organization = Array.isArray(data.organizations)
    ? data.organizations[0]
    : data.organizations;

  if (!organization) return null;

  return {
    id: data.organization_id,
    name: organization.name,
    role: data.role,
  };
}

export async function getCurrentOrganization(): Promise<CurrentOrganization> {
  const organization = await findCurrentOrganization();

  if (!organization) {
    throw new Error("No active organization is assigned to your account.");
  }

  return organization;
}

export async function getCurrentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user.id;
}
