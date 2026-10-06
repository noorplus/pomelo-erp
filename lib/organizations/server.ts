import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError, type ApplicationContext } from "@/lib/app/types";
import { listActiveOrganizations } from "@/lib/organizations/queries";

function isMissingAuthSession(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const authError = error as { __isAuthError?: boolean; name?: string; code?: string };
  return (
    authError.__isAuthError === true &&
    (authError.name === "AuthSessionMissingError" || authError.code === "session_not_found")
  );
}

export async function getApplicationContext(): Promise<ApplicationContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    if (isMissingAuthSession(userError)) {
      redirect("/login");
    }

    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Unable to verify the current session.",
      userError,
    );
  }

  if (!user) {
    redirect("/login");
  }

  const { memberships, organizations } = await listActiveOrganizations(supabase, user.id);
  const organizationById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );

  const accessibleOrganizations = memberships
    .map((membership) => organizationById.get(membership.organization_id))
    .filter(
      (organization): organization is (typeof organizations)[number] =>
        Boolean(organization),
    );

  return {
    user,
    memberships,
    organizations: accessibleOrganizations,
    activeOrganization: accessibleOrganizations[0] ?? null,
  };
}
