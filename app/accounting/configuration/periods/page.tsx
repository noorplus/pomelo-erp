import { ErpPageShell } from "@/components/erp-page-shell";
import { ConfigurationManager } from "@/components/configuration-manager";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { savePeriod, togglePeriod } from "@/app/configuration/actions";

export default async function PeriodsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const org = await getCurrentOrganization();
  const supabase = await createClient();
  const params = await searchParams;
  const [{ data: rows }, { data: editingRow }] = await Promise.all([
    supabase.from("accounting_periods").select("id,name,start_date,end_date,status,closed_at").eq("organization_id", org.id).order("start_date", { ascending: false }),
    params.edit ? supabase.from("accounting_periods").select("id,name,start_date,end_date,status,closed_at").eq("organization_id", org.id).eq("id", params.edit).maybeSingle() : Promise.resolve({ data: undefined }),
  ]);

  return <ErpPageShell>
    <div className="config-page">
      <div className="page-heading"><div className="page-heading-copy"><p className="eyebrow">Accounting · Configuration</p><h1>Accounting Periods</h1><p>Define posting periods and control when accounting entries can be posted.</p></div></div>
      <ConfigurationManager
        title="Accounting Period"
        description="Closed periods are protected by the database posting rules."
        action={savePeriod}
        toggleAction={togglePeriod}
        fields={[{ name: "name", label: "Period name", required: true }, { name: "start_date", label: "Start date", type: "date", required: true }, { name: "end_date", label: "End date", type: "date", required: true }, { name: "closed_at", label: "Closed at", readOnly: true }]}
        rows={rows ?? []}
        editingRow={editingRow ?? undefined}
        editHref="/accounting/configuration/periods"
        newHref="/accounting/configuration/periods"
        emptyText="No accounting periods have been configured yet."
        editDisabledBy={{ field: "status", values: ["closed"] }}
        hideToggleBy={{ field: "status", values: ["closed"] }}
      />
    </div>
  </ErpPageShell>;
}
