import { createClient } from "@/lib/supabase/server";
import { findCurrentOrganization } from "@/lib/supabase/organization";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const organization = await findCurrentOrganization();

  if (!organization) redirect("/onboarding");

  return (
    <AppShell organization={organization} user={user}>
      {children}
    </AppShell>
  );
}
