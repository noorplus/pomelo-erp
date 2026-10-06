import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError, type ApplicationContext } from "@/lib/app/types";
import { listActiveOrganizations } from "@/lib/organizations/queries";

export async function getApplicationContext(): Promise<ApplicationContext> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new AppError("AUTHENTICATION_REQUIRED", "Unable to verify the current session.", userError);
  }

  if (!user) {
    redirect("/login");
  }

  const { memberships, organizations } = await listActiveOrganizations(supabase, user.id);
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));

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
