import { Administration } from "@/components/app/administration";
import { getApplicationContext } from "@/lib/organizations/server";
import { isOrganizationCreator, listOrganizationMembers } from "@/lib/organizations/queries";
import { createClient } from "@/lib/supabase/server";

export default async function AdministrationPage() {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;

  const supabase = await createClient();
  const [memberships, creator] = await Promise.all([
    listOrganizationMembers(supabase, context.activeOrganization.id),
    isOrganizationCreator(supabase, context.activeOrganization.id, context.user.id),
  ]);

  return (
    <Administration
      organization={context.activeOrganization}
      memberships={memberships}
      userId={context.user.id}
      creator={creator}
    />
  );
}
