import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/organization";

type SettingCard = { title: string; description: string; count: number; label: string; status: string };

export default async function SettingsPage() {
  const organization = await getCurrentOrganization();
  const supabase = await createClient();

  const [{ data: profile }, { count: users }, { count: units }, { count: accounts }, { count: sequences }, { count: periods }, { count: expenseCategories }] =
    await Promise.all([
      supabase.from("organizations").select("name,legal_name,phone,email,address,city,country,base_currency,timezone,logo_url,tax_number,is_active").eq("id", organization.id).maybeSingle(),
      supabase.from("organization_users").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
      supabase.from("units_of_measure").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
      supabase.from("accounts").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
      supabase.from("number_sequences").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
      supabase.from("accounting_periods").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
      supabase.from("expense_categories").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
    ]);

  const profileFields = [profile?.name, profile?.legal_name, profile?.phone, profile?.email, profile?.address, profile?.city, profile?.country, profile?.base_currency, profile?.timezone, profile?.tax_number];
  const completedProfileFields = profileFields.filter(Boolean).length;
  const profileStatus = completedProfileFields === profileFields.length ? "Complete" : "Needs attention";

  const settings: SettingCard[] = [
    { title: "Organization profile", description: "Company identity, legal details, contact information, currency and timezone.", count: completedProfileFields, label: completedProfileFields + "/10 fields", status: profileStatus },
    { title: "Users & roles", description: "Organization members and their Owner, Admin, Manager or Staff roles.", count: users ?? 0, label: "members", status: (users ?? 0) > 0 ? "Configured" : "Needs attention" },
    { title: "Units of measure", description: "Units available for product and inventory transactions.", count: units ?? 0, label: "units", status: (units ?? 0) > 0 ? "Configured" : "Not configured" },
    { title: "Chart of accounts", description: "Organization-specific accounts used by sales, purchases, inventory and expenses.", count: accounts ?? 0, label: "accounts", status: (accounts ?? 0) > 0 ? "Configured" : "Needs attention" },
    { title: "Numbering", description: "Document sequences for products, invoices, payments and other business documents.", count: sequences ?? 0, label: "sequences", status: (sequences ?? 0) > 0 ? "Configured" : "Not configured" },
    { title: "Accounting periods", description: "Open and closed periods that control when accounting transactions can be posted.", count: periods ?? 0, label: "periods", status: (periods ?? 0) > 0 ? "Configured" : "Not configured" },
    { title: "Expense categories", description: "Expense classifications mapped to the organization’s expense accounts.", count: expenseCategories ?? 0, label: "categories", status: (expenseCategories ?? 0) > 0 ? "Configured" : "Not configured" },
  ];

  return (
    <div className="settings-page">
      <section className="page-heading">
        <div><p className="eyebrow">Settings</p><h1>Organization settings</h1><p>Configure how {organization.name} operates across the ERP.</p></div>
        <div className="settings-role-badge">{organization.role}</div>
      </section>

      <section className="settings-profile panel">
        <div className="settings-profile-main">
          <div className="settings-org-avatar">{(organization.name[0] || "O").toUpperCase()}</div>
          <div><p className="eyebrow">Current organization</p><h2>{organization.name}</h2><p>{profile?.legal_name || "Legal name not configured"} · {profile?.base_currency || "BDT"} · {profile?.timezone || "Asia/Dhaka"}</p></div>
        </div>
        <div className="settings-profile-meta"><span className={profile?.is_active ? "status-pill active" : "status-pill"}>{profile?.is_active ? "Active" : "Inactive"}</span><span>{organization.role}</span></div>
      </section>

      <section>
        <div className="section-heading"><div><h2>Configuration</h2><p>These settings are backed by the existing organization-scoped database tables.</p></div></div>
        <div className="settings-grid">
          {settings.map((item) => (
            <article className="settings-card" key={item.title}>
              <div className="settings-card-top"><div><h3>{item.title}</h3><p>{item.description}</p></div><span className={item.status === "Configured" || item.status === "Complete" ? "settings-status ready" : "settings-status"}>{item.status}</span></div>
              <div className="settings-card-bottom"><strong>{item.count}</strong><span>{item.label}</span>{item.title === "Numbering" ? <Link href="/settings/number-sequences" className="text-button">Open configuration</Link> : <span className="settings-coming">Configuration UI</span>}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-note"><strong>Settings architecture</strong><span>This page is the organization-level configuration hub. Transactional records such as sales, purchases, payments, expenses and inventory movements remain in their respective ERP modules.</span></section>
    </div>
  );
}