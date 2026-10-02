import { ErpPageShell } from "@/components/erp-page-shell";
import { PageHeader } from "@/components/page-header";
import { DataTable, DataTableEmpty } from "@/components/data-table";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";

export default async function UsersSettingsPage() {
  const organization = await getCurrentOrganization();
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data, error } = await supabase.from("organization_users").select("id,user_id,role,is_active,created_at").eq("organization_id", organization.id).order("created_at");
  return <ErpPageShell>
    <div className="settings-page">
      <PageHeader eyebrow="System administration" title="Users & Roles" description="Review the organization membership records currently exposed by the database." actions={<a className="secondary-button compact" href="/settings">Back</a>} />
      <section className="panel">
        <div className="panel-heading"><div><h2>Organization members</h2><p>{data?.length ?? 0} membership records</p></div></div>
        {error ? <DataTableEmpty title="Unable to load members" description={error.message} /> : data?.length ? (
          <DataTable minWidth={680} ariaLabel="Organization members">
            <thead><tr><th>User ID</th><th>Role</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>{data.map(row => <tr key={row.id}><td><code>{row.user_id}</code></td><td>{row.role}</td><td><span className={row.is_active ? "status-pill active":"status-pill"}>{row.is_active?"Active":"Inactive"}</span></td><td>{new Intl.DateTimeFormat("en-BD",{dateStyle:"medium"}).format(new Date(row.created_at))}</td></tr>)}</tbody>
          </DataTable>
        ) : <DataTableEmpty title="No organization members" description="No membership records were returned for the current organization." />}
      </section>
    </div>
  </ErpPageShell>;
}
