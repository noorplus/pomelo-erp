import { ErpPageShell } from "@/components/erp-page-shell";
import { ConfigurationManager } from "@/components/configuration-manager";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { saveNumberSequence } from "@/app/configuration/actions";

export default async function NumberSequencesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const org = await getCurrentOrganization();
  const supabase = await createClient();
  const params = await searchParams;
  const [{ data: rows }, { data: editingRow }] = await Promise.all([
    supabase.from("number_sequences").select("id,document_type,prefix,next_number,padding,is_active").eq("organization_id", org.id).order("document_type"),
    params.edit ? supabase.from("number_sequences").select("id,document_type,prefix,next_number,padding,is_active").eq("organization_id", org.id).eq("id", params.edit).maybeSingle() : Promise.resolve({ data: undefined }),
  ]);

  return <ErpPageShell>
    <div className="config-page">
      <div className="page-heading">
        <div className="page-heading-copy">
          <p className="eyebrow">System · Configuration</p>
          <h1>Number Sequences</h1>
          <p>Configure prefixes, counters and padding for the existing database-managed document numbering.</p>
        </div>
      </div>
      <ConfigurationManager
        title="Number Sequence"
        description="Sequence keys are created by the existing numbering logic. The frozen database does not treat an existing inactive sequence as disabled, so this page exposes its state without offering a misleading activate/deactivate control."
        action={saveNumberSequence}
        canCreate={false}
        fields={[
          { name: "document_type", label: "Document type", readOnly: true },
          { name: "prefix", label: "Prefix", placeholder: "e.g. INV-" },
          { name: "next_number", label: "Next number", type: "number", required: true },
          { name: "padding", label: "Padding", type: "number", required: true, placeholder: "1–12" },
          { name: "is_active", label: "Active flag", type: "checkbox", readOnly: true },
        ]}
        rows={(rows ?? []) as Record<string, unknown>[]}
        editingRow={editingRow as Record<string, unknown> | undefined}
        editHref="/settings/number-sequences"
        newHref="/settings/number-sequences"
        emptyText="No number sequences have been created yet. They appear when the existing database numbering function first needs them."
      />
    </div>
  </ErpPageShell>;
}
