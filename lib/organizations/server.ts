import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError, type ApplicationContext } from "@/lib/app/types";

export async function getApplicationContext(): Promise<ApplicationContext> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new AppError("AUTHENTICATION_REQUIRED", "Unable to verify the current session.", userError);
  }

  if (!user) {
    redirect("/login");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_users")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw new AppError("DATABASE_ERROR", "Unable to load organization memberships.", membershipError);
  }

  if (memberships.length === 0) {
    return {
      user,
      memberships: [],
      organizations: [],
      activeOrganization: null,
    };
  }

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const { data: organizations, error: organizationError } = await supabase
    .from("organizations")
    .select("*")
    .in("id", organizationIds)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (organizationError) {
    throw new AppError("DATABASE_ERROR", "Unable to load organizations.", organizationError);
  }

  const organizationById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );

  const accessibleOrganizations = memberships
    .map((membership) => organizationById.get(membership.organization_id))
    .filter((organization): organization is (typeof organizations)[number] => Boolean(organization));

  return {
    user,
    memberships,
    organizations: accessibleOrganizations,
    activeOrganization: accessibleOrganizations[0] ?? null,
  };
}
