import { AppShell } from "@/components/app-shell";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type SettingsCard = {
  title: string;
  description: string;
  value: string;
  detail: string;
};

function formatDate(value: string | null) {
  if (!value) return "Not configured";
  return new Intl.DateTimeFormat("en-BD", { dateStyle: "medium" }).format(new Date(value));
}

export default async function SettingsPage() {
  const organization = await getCurrentOrganization();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    organizationResult,
    usersResult,
    accountsResult,
    periodsResult,
    sequencesResult,
    unitsResult,
    productsResult,
    expenseCategoriesResult,
  ] = await Promise.all([
    supabase.from("organizations").select("name, phone, email, address, city, country, base_currency, timezone, logo_url, tax_number, is_active, created_at").eq("id", organization.id).maybeSingle(),
    supabase.from("organization_users").select("user_id", { count: "exact", head: true }).eq("organization_id", organization.id).eq("is_active", true),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
    supabase.from("accounting_periods").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).eq("status", "open"),
    supabase.from("number_sequences").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).eq("is_active", true),
    supabase.from("units_of_measure").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).eq("is_active", true),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
    supabase.from("expense_categories").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).eq("is_active", true),
  ]);

  const org = organizationResult.data;
  const settingsCards: SettingsCard[] = [
    { title: "Users & Access", description: "Active organization members and role assignments.", value: String(usersResult.count ?? 0), detail: "active users" },
    { title: "Accounting", description: "Chart of accounts and current posting-period controls.", value: String(accountsResult.count ?? 0), detail: `${periodsResult.count ?? 0} open periods` },
    { title: "Numbering", description: "Automatic sequences for ERP documents and master records.", value: String(sequencesResult.count ?? 0), detail: "active sequences" },
    { title: "Master Data", description: "Products, units of measure, and expense classifications.", value: String(productsResult.count ?? 0), detail: `${unitsResult.count ?? 0} units · ${expenseCategoriesResult.count ?? 0} expense categories` },
  ];

  const organizationInitial = (org?.name || organization.name || "P").trim().charAt(0).toUpperCase();

  return (
    <AppShell organization={organization} user={user}>
      <div className="settings-page">
        <section className="page-heading">
          <div className="page-heading-copy">
            <p className="eyebrow">System</p>
            <h1>Settings</h1>
            <p>Organization and ERP configuration at a glance.</p>
          </div>
          <span className="settings-role-badge">{organization.role}</span>
        </section>

        <section className="panel settings-profile" aria-labelledby="organization-summary">
          <div className="settings-profile-main">
            <div className="settings-org-avatar" aria-hidden="true">{organizationInitial}</div>
            <div>
              <p className="eyebrow">Organization</p>
              <h2 id="organization-summary">{org?.name || organization.name}</h2>
              <p>{[org?.city, org?.country].filter(Boolean).join(", ") || "Location not configured"}</p>
            </div>
          </div>
          <div className="settings-profile-meta">
            <span>{org?.base_currency || "BDT"}</span>
            <span>{org?.timezone || "Asia/Dhaka"}</span>
            <span className={org?.is_active ? "status-pill active" : "status-pill"}>{org?.is_active ? "Active" : "Inactive"}</span>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-configuration">
          <div className="section-heading">
            <div>
              <h2 id="settings-configuration">Configuration</h2>
              <p>Current records available from the existing ERP schema.</p>
            </div>
          </div>
          <div className="settings-grid">
            {settingsCards.map((card) => (
              <article className="settings-card" key={card.title}>
                <div className="settings-card-top">
                  <div><h3>{card.title}</h3><p>{card.description}</p></div>
                  <span className="settings-status ready">Ready</span>
                </div>
                <div className="settings-card-bottom"><strong>{card.value}</strong><span>{card.detail}</span></div>
              </article>
            ))}
          </div>
        </section>

        <section className="settings-info-grid" aria-label="Organization information">
          <article className="panel read-only-panel settings-info-card">
            <p className="eyebrow">Contact</p>
            <strong>{org?.email || "No email configured"}</strong>
            <span>{org?.phone || "No phone configured"}</span>
            <span>{org?.address || "No address configured"}</span>
            <span>Tax number: {org?.tax_number || "Not configured"}</span>
          </article>
          <article className="panel read-only-panel settings-info-card">
            <p className="eyebrow">System</p>
            <strong>{org?.is_active ? "Organization active" : "Organization inactive"}</strong>
            <span>Created {formatDate(org?.created_at ?? null)}</span>
            <span>Base currency: {org?.base_currency || "BDT"}</span>
            <span>Timezone: {org?.timezone || "Asia/Dhaka"}</span>
          </article>
        </section>

        <div className="settings-note">
          <strong>Configuration boundary</strong>
          <span>Settings currently provides a read-only overview. Editing workflows will be added section-by-section using the existing tables, permissions, and business rules; no new settings table is required.</span>
        </div>
      </div>
    </AppShell>
  );
}
