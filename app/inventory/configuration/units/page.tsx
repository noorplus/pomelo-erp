import { ErpPageShell } from "@/components/erp-page-shell";
import { ConfigurationManager } from "@/components/configuration-manager";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { saveUnit, toggleUnit } from "@/app/configuration/actions";

export default async function UnitsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const org = await getCurrentOrganization();
  const supabase = await createClient();
  const params = await searchParams;
  const [{ data: rows }, { data: editingRow }] = await Promise.all([
    supabase.from("units_of_measure").select("id,name,is_active,created_at").eq("organization_id", org.id).order("name"),
    params.edit ? supabase.from("units_of_measure").select("id,name,is_active,created_at").eq("organization_id", org.id).eq("id", params.edit).maybeSingle() : Promise.resolve({ data: undefined }),
  ]);

  return <ErpPageShell>
    <div className="config-page">
      <div className="page-heading">
        <div className="page-heading-copy"><p className="eyebrow">Inventory · Configuration</p><h1>Units of Measure</h1><p>Manage the units used by inventory and product records.</p></div>
      </div>
      <ConfigurationManager
        title="Unit of Measure"
        description="Only the existing units_of_measure table is used."
        action={saveUnit}
        toggleAction={toggleUnit}
        fields={[{ name: "name", label: "Name", required: true }, { name: "is_active", label: "Active", type: "checkbox" }]}
        rows={rows ?? []}
        editingRow={editingRow ?? undefined}
        editHref="/inventory/configuration/units"
        newHref="/inventory/configuration/units"
        emptyText="No units of measure have been configured yet."
      />
    </div>
  </ErpPageShell>;
}
