import { AppShell } from "@/components/app-shell";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type SettingsCard = {
  title: string;
  description: string;
  count: number;
  label: string;
};

function formatDate(value: string | null) {
  if (!value) return "Not configured";
  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
  }).format(new Date(value));
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
    supabase
      .from("organizations")
      .select("name, phone, email, address, city, country, base_currency, timezone, logo_url, tax_number, is_active, created_at")
      .eq("id", organization.id)
      .maybeSingle(),
    supabase
      .from("organization_users")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("is_active", true),
    supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    supabase
      .from("accounting_periods")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "open"),
    supabase
      .from("number_sequences")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("is_active", true),
    supabase
      .from("units_of_measure")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("is_active", true),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    supabase
      .from("expense_categories")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("is_active", true),
  ]);

  const org = organizationResult.data;
  const settingsCards: SettingsCard[] = [
    {
      title: "Users & Access",
      description: "Organization membership, active users, and role assignments.",
      count: usersResult.count ?? 0,
      label: "active users",
    },
    {
      title: "Chart of Accounts",
      description: "Accounts, control accounts, system accounts, and posting configuration.",
      count: accountsResult.count ?? 0,
      label: "accounts",
    },
    {
      title: "Accounting Periods",
      description: "Open accounting periods used to control transaction posting.",
      count: periodsResult.count ?? 0,
      label: "open periods",
    },
    {
      title: "Number Sequences",
      description: "Automatic document numbering for products, contacts, invoices, payments, and journals.",
      count: sequencesResult.count ?? 0,
      label: "active sequences",
    },
    {
      title: "Units of Measure",
      description: "Reusable units used by the product and inventory master data.",
      count: unitsResult.count ?? 0,
      label: "active units",
    },
    {
      title: "Expense Categories",
      description: "Expense classifications mapped to the accounting chart of accounts.",
      count: expenseCategoriesResult.count ?? 0,
      label: "active categories",
    },
  ];

  const organizationInitial = (org?.name || organization.name || "P").trim().charAt(0).toUpperCase();

  return (
    <AppShell organization={organization} user={user}>
      <div className="settings-page">
        <section className="page-heading">
          <div className="page-heading-copy">
            <p className="eyebrow">System</p>
            <h1>Settings</h1>
            <p>Configuration center built from the existing ERP database model.</p>
          </div>
          <span className="settings-role-badge">{organization.role}</span>
        </section>

        <section className="panel settings-profile" aria-labelledby="organization-summary">
          <div className="settings-profile-main">
            <div className="settings-org-avatar" aria-hidden="true">{organizationInitial}</div>
            <div>
              <p className="eyebrow">Organization</p>
              <h2 id="organization-summary">{org?.name || organization.name}</h2>
              <p>
                {[org?.city, org?.country].filter(Boolean).join(", ") || "Location not configured"}
              </p>
            </div>
          </div>
          <div className="settings-profile-meta">
            <span>{org?.base_currency || "BDT"}</span>
            <span>{org?.timezone || "Asia/Dhaka"}</span>
            <span className={org?.is_active ? "status-pill active" : "status-pill"}>
              {org?.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </section>

        <section>
          <div className="section-heading">
            <div>
              <h2>Configuration</h2>
              <p>Each section maps directly to an existing normalized database table.</p>
            </div>
          </div>
          <div className="settings-grid">
            {settingsCards.map((card) => (
              <article className="settings-card" key={card.title}>
                <div className="settings-card-top">
                  <div>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </div>
                  <span className="settings-status ready">Database ready</span>
                </div>
                <div className="settings-card-bottom">
                  <strong>{card.count}</strong>
                  <span>{card.label}</span>
                  <span className="settings-coming">Configuration UI next</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="settings-grid">
          <article className="panel read-only-panel">
            <p className="eyebrow">Organization details</p>
            <strong>{org?.email || "No email configured"}</strong>
            <span>{org?.phone || "No phone configured"}</span>
            <span>{org?.address || "No address configured"}</span>
            <span>Tax number: {org?.tax_number || "Not configured"}</span>
          </article>
          <article className="panel read-only-panel">
            <p className="eyebrow">System status</p>
            <strong>{org?.is_active ? "Organization active" : "Organization inactive"}</strong>
            <span>Created {formatDate(org?.created_at ?? null)}</span>
            <span>Products currently registered: {productsResult.count ?? 0}</span>
            <span>Core accounting and configuration data remain controlled by the existing ERP schema.</span>
          </article>
        </section>

        <div className="settings-note">
          <strong>Implementation boundary</strong>
          <span>
            This first Settings release is a live configuration overview. Editing workflows will be added section-by-section against the existing database and its permission rules; no new settings table is required.
          </span>
        </div>
      </div>
    </AppShell>
  );
}
