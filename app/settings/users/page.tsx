import { AppShell } from "@/components/app-shell";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function UsersSettingsPage() {
  const organization = await getCurrentOrganization();
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data } = await supabase.from("organization_users").select("id,user_id,role,is_active,created_at").eq("organization_id", organization.id).order("created_at");
  return <AppShell organization={organization} user={user}>
    <div className="settings-page">
      <div className="page-heading"><div><p className="eyebrow">System administration</p><h1>Users & Roles</h1><p>Review the organization membership records currently exposed by the database.</p></div><Link className="secondary-button compact" href="/settings">Back to settings</Link></div>
      <section className="panel"><div className="panel-heading"><div><h2>Organization members</h2><p>{data?.length ?? 0} membership records</p></div></div>
        <div className="data-table-scroll"><table className="data-table"><thead><tr><th>User ID</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>
          {(data ?? []).map(row=><tr key={row.id}><td><code>{row.user_id}</code></td><td>{row.role}</td><td><span className={row.is_active ? "status-pill active":"status-pill"}>{row.is_active?"Active":"Inactive"}</span></td><td>{new Intl.DateTimeFormat("en-BD",{dateStyle:"medium"}).format(new Date(row.created_at))}</td></tr>)}
        </tbody></table></div>
      </section>
    </div>
  </AppShell>;
}
