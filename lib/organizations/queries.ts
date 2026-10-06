import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";

export async function listActiveOrganizations(
  supabase: TypedSupabaseClient,
  userId: string,
) {
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_users")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (membershipError) {
    throwSupabaseError(
      membershipError,
      "DATABASE_ERROR",
      "Unable to load organization memberships.",
    );
  }

  if (memberships.length === 0) {
    return { memberships, organizations: [] };
  }

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const { data: organizations, error: organizationError } = await supabase
    .from("organizations")
    .select("*")
    .in("id", organizationIds)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (organizationError) {
    throwSupabaseError(
      organizationError,
      "DATABASE_ERROR",
      "Unable to load organizations.",
    );
  }

  return {
    memberships,
    organizations,
  };
}
