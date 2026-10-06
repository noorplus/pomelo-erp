import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Authenticated</p>
        <h1>Pomelo ERP</h1>
        <p className="lede">
          Your application shell is ready. Organization-aware ERP modules will
          be added on top of this foundation.
        </p>
      </section>
    </main>
  );
}