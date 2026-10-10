import { Administration } from "@/components/app/administration";
import { getApplicationContext } from "@/lib/organizations/server";
import { isOrganizationCreator, listOrganizationMembers } from "@/lib/organizations/queries";
import { createClient } from "@/lib/supabase/server";
import { listNumberSequences } from "@/lib/administration/queries";

export default async function AdministrationPage() {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;

  const supabase = await createClient();
  const [memberships, creator, numberSequences] = await Promise.all([
    listOrganizationMembers(supabase, context.activeOrganization.id),
    isOrganizationCreator(supabase, context.activeOrganization.id, context.user.id),
    listNumberSequences(supabase, context.activeOrganization.id),
  ]);

  return (
    <Administration
      organization={context.activeOrganization}
      memberships={memberships}
      userId={context.user.id}
      creator={creator}
      numberSequences={numberSequences}
    />
  );
}
