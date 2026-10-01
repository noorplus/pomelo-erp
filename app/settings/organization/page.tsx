import { AppShell } from "@/components/app-shell";
import { ConfigurationManager } from "@/components/configuration-manager";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { saveOrganization } from "@/app/configuration/actions";

export default async function OrganizationSettingsPage() {
  const organization = await getCurrentOrganization();
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data } = await supabase.from("organizations").select("id,name,phone,email,address,city,country,base_currency,timezone,logo_url,tax_number,is_active").eq("id", organization.id).maybeSingle();
  const fields = [
    { name:"name", label:"Organization name", required:true },
    { name:"phone", label:"Phone" },
    { name:"email", label:"Email", type:"text" as const },
    { name:"address", label:"Address" },
    { name:"city", label:"City" },
    { name:"country", label:"Country" },
    { name:"base_currency", label:"Base currency", required:true },
    { name:"timezone", label:"Timezone", required:true },
    { name:"logo_url", label:"Logo URL" },
    { name:"tax_number", label:"Tax number" },
  ];
  return <AppShell organization={organization} user={user}>
    <div className="settings-page">
      <div className="page-heading"><div><p className="eyebrow">System administration</p><h1>Organization</h1><p>Edit the existing organizations record. No schema changes are used.</p></div></div>
      <ConfigurationManager title="Organization" description="Organization identity and accounting locale." action={saveOrganization} fields={fields} rows={data ? [data] : []} editingRow={data ?? undefined} editHref="/settings/organization" newHref="/settings/organization" emptyText="Organization record not found." />
    </div>
  </AppShell>;
}
