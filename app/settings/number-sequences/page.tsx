import { ErpPageShell } from "@/components/erp-page-shell";
import { ConfigurationManager } from "@/components/configuration-manager";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";

export default async function NumberSequencesPage() {
  const org = await getCurrentOrganization();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("number_sequences")
    .select("id,document_type,prefix,next_number,padding,is_active")
    .eq("organization_id", org.id)
    .order("document_type");

  return (
    <ErpPageShell>
      <div className="config-page">
        <div className="page-heading">
          <div className="page-heading-copy">
            <p className="eyebrow">System · Configuration</p>
            <h1>Number Sequences</h1>
            <p>View the prefixes, counters and padding maintained by the existing database-managed numbering logic.</p>
          </div>
        </div>
        <ConfigurationManager
          title="Number Sequence"
          description="The live database grants the authenticated role read access to number_sequences only. This screen therefore stays read-only and does not expose actions that the database cannot execute."
          fields={[
            { name: "document_type", label: "Document type" },
            { name: "prefix", label: "Prefix" },
            { name: "next_number", label: "Next number", type: "number" },
            { name: "padding", label: "Padding", type: "number" },
            { name: "is_active", label: "Active flag", type: "checkbox" },
          ]}
          rows={(rows ?? []) as Record<string, unknown>[]}
          editHref="/settings/number-sequences"
          newHref="/settings/number-sequences"
          emptyText="No number sequences have been created yet. They appear when the existing database numbering function first needs them."
          readOnly
          canCreate={false}
        />
      </div>
    </ErpPageShell>
  );
}
