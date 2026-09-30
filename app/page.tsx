import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { findCurrentOrganization } from "@/lib/supabase/organization";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const organization = await findCurrentOrganization();
  if (!organization) redirect("/onboarding");

  return (
    <AppShell organization={organization} user={user}>
      <div className="dashboard-page">
        <section className="dashboard-heading">
          <p className="eyebrow">Dashboard</p>
          <h1>Pomelo ERP</h1>
          <p>Overview of your organization and quick access to ERP modules.</p>
        </section>
      </div>
    </AppShell>
  );
}
