import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const organization = await getCurrentOrganization();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: org }, { count: users }] = await Promise.all([
    supabase.from("organizations").select("name,phone,email,address,city,country,base_currency,timezone,logo_url,tax_number,is_active,created_at").eq("id", organization.id).maybeSingle(),
    supabase.from("organization_users").select("user_id", { count: "exact", head: true }).eq("organization_id", organization.id).eq("is_active", true),
  ]);

  const cards = [
    { href: "/settings/organization", title: "Organization", description: "Company identity, contact details, currency, timezone, logo and tax information.", meta: "System administration" },
    { href: "/settings/users", title: "Users & Roles", description: "Review organization membership and role assignments.", meta: (users ?? 0) + " active users" },
    { href: "/accounting/configuration/sequences", title: "Number Sequences", description: "Review automatic numbering for products, contacts, invoices, payments and journals.", meta: "Database controlled" },
  ];

  return (
    <AppShell organization={organization} user={user}>
      <div className="settings-page">
        <section className="page-heading">
          <div className="page-heading-copy">
            <p className="eyebrow">System administration</p>
            <h1>Settings</h1>
            <p>Only system-wide configuration lives here. Business configuration stays inside its owning module.</p>
          </div>
          <span className="settings-role-badge">{organization.role}</span>
        </section>

        <section className="panel settings-profile">
          <div className="settings-profile-main">
            <div className="settings-org-avatar" aria-hidden="true">{(org?.name || organization.name).trim().charAt(0).toUpperCase()}</div>
            <div>
              <p className="eyebrow">Current organization</p>
              <h2>{org?.name || organization.name}</h2>
              <p>{[org?.city, org?.country].filter(Boolean).join(", ") || "Location not configured"}</p>
            </div>
          </div>
          <div className="settings-profile-meta">
            <span>{org?.base_currency || "BDT"}</span>
            <span>{org?.timezone || "Asia/Dhaka"}</span>
            <span className={org?.is_active ? "status-pill active" : "status-pill"}>{org?.is_active ? "Active" : "Inactive"}</span>
          </div>
        </section>

        <section>
          <div className="section-heading">
            <div><h2>System settings</h2><p>These are intentionally kept separate from operational module configuration.</p></div>
          </div>
          <div className="settings-grid settings-hub-grid">
            {cards.map((card) => (
              <Link className="settings-card settings-link-card" href={card.href} key={card.href}>
                <div className="settings-card-top">
                  <div><h3>{card.title}</h3><p>{card.description}</p></div>
                  <span className="settings-status ready">{card.meta}</span>
                </div>
                <div className="settings-card-bottom"><span>Open configuration →</span></div>
              </Link>
            ))}
          </div>
        </section>

        <section className="settings-note">
          <strong>Configuration ownership</strong>
          <span>Accounting configuration is under Accounting, inventory configuration is under Inventory, and expense categories are under Expenses. No new settings table or migration is required.</span>
        </section>
      </div>
    </AppShell>
  );
}
