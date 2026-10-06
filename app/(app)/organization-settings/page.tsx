import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrganizationSettings } from "@/components/app/organization-settings";
import { getApplicationContext } from "@/lib/organizations/server";
import { listOrganizationMembers, isOrganizationCreator } from "@/lib/organizations/queries";

export default async function OrganizationSettingsPage() {
  const context = await getApplicationContext();
  if (!context.activeOrganization) redirect("/");
  const supabase = await createClient();
  const [memberships, creator] = await Promise.all([
    listOrganizationMembers(supabase, context.activeOrganization.id),
    isOrganizationCreator(supabase, context.activeOrganization.id, context.user.id),
  ]);
  return <OrganizationSettings organization={context.activeOrganization} memberships={memberships} userId={context.user.id} creator={creator} />;
}
