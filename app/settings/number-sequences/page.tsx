import { ErpPageShell } from "@/components/erp-page-shell";
import { DataTable, DataTableEmpty } from "@/components/data-table";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";

export default async function NumberSequencesPage() {
  const org = await getCurrentOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase.from("number_sequences").select("id,document_type,prefix,next_number,padding,is_active").eq("organization_id", org.id).order("document_type");
  return <ErpPageShell>
    <div className="config-page">
      <div className="page-heading"><div className="page-heading-copy"><p className="eyebrow">System · Configuration</p><h1>Number Sequences</h1><p>Automatic document numbering used across the ERP. Counters are managed by the database trigger.</p></div></div>
      <section className="panel">
        <div className="panel-heading"><div><h2>Sequence definitions</h2><p>{data?.length ?? 0} configured sequences</p></div><span className="read-only-badge">Database managed</span></div>
        {error ? <DataTableEmpty title="Unable to load sequences" description={error.message} /> : data?.length ? <DataTable minWidth={680} ariaLabel="Number sequences"><thead><tr><th>Key</th><th>Prefix</th><th>Next number</th><th>Padding</th><th>Status</th></tr></thead><tbody>{data.map(row => <tr key={row.id}><td><code>{row.document_type}</code></td><td><code>{row.prefix}</code></td><td className="numeric">{row.next_number}</td><td className="numeric">{row.padding}</td><td><span className={row.is_active ? "status-pill active" : "status-pill"}>{row.is_active ? "Active" : "Inactive"}</span></td></tr>)}</tbody></DataTable> : <DataTableEmpty title="No number sequences found" description="Sequences are created on demand by the existing database numbering function." />}
      </section>
    </div>
  </ErpPageShell>;
}
