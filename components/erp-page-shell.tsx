import { AppShell } from "@/components/app-shell";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function ErpPageShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const organization = await getCurrentOrganization();
  if (!organization) redirect("/onboarding");

  return (
    <AppShell organization={organization} user={user}>
      {children}
    </AppShell>
  );
}
