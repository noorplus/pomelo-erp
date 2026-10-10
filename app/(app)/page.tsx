import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { OrganizationOnboarding } from "@/components/app/organization-onboarding";
import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getDashboardData } from "@/lib/dashboard/queries";

export default async function DashboardPage() {
  const context = await getApplicationContext();

  if (!context.activeOrganization) return <OrganizationOnboarding />;

  const organization = context.activeOrganization;
  const data = await getDashboardData(
    await createClient(),
    organization.id,
    organization.base_currency ?? "BDT",
    organization.timezone ?? "Asia/Dhaka",
  );

  return <DashboardOverview organizationName={organization.name} data={data} />;
}
