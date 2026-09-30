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
      <div className="home-page">
        <section className="home-heading">
          <p className="eyebrow">Home</p>
          <h1>{organization.name}</h1>
          <p>Your ERP workspace. Choose a section from the navigation to continue.</p>
        </section>
      </div>
    </AppShell>
  );
}
