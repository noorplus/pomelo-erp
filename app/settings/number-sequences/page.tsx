import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/organization";

type Sequence = { id: string; document_type: string; prefix: string; next_number: number; padding: number; is_active: boolean; created_at: string };
const labels: Record<string, string> = { journal: "Journal entries", inventory: "Inventory transactions", purchase: "Purchase invoices", sale: "Sales invoices", expense: "Expenses", payment: "Payments" };
function formatPreview(sequence: Sequence) { return sequence.prefix + String(sequence.next_number).padStart(sequence.padding, "0"); }
function titleCase(value: string) { return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()); }

export default async function NumberSequencesPage() {
  const organization = await getCurrentOrganization();
  const supabase = await createClient();
  const { data: sequences, error } = await supabase.from("number_sequences").select("id, document_type, prefix, next_number, padding, is_active, created_at").eq("organization_id", organization.id).order("document_type", { ascending: true });
  if (error) throw new Error("Unable to load number sequence configuration.");
  const active = (sequences ?? []).filter((sequence) => sequence.is_active);
  const inactive = (sequences ?? []).filter((sequence) => !sequence.is_active);
  const supportedTypes = Object.keys(labels);

  return (
    <div className="settings-page">
      <section className="page-heading">
        <div><Link href="/settings" className="back-link">← Settings</Link><p className="eyebrow">Settings · Numbering</p><h1>Number sequences</h1><p>Organization-scoped document numbering backed directly by the ERP sequence ledger.</p></div>
        <span className="settings-role-badge">Read-only control</span>
      </section>
      <section className="settings-profile panel">
        <div className="settings-profile-main"><div className="settings-org-avatar">#</div><div><p className="eyebrow">Sequence engine</p><h2>{organization.name}</h2><p>{active.length} active · {inactive.length} inactive · {sequences?.length ?? 0} configured sequences</p></div></div>
        <div className="settings-profile-meta"><span className="status-pill active">Transactional</span><span>Concurrency safe</span></div>
      </section>
      <section>
        <div className="section-heading"><div><h2>Configured sequences</h2><p>The database advances these counters inside the transaction that creates the business document.</p></div></div>
        {sequences && sequences.length > 0 ? <div className="panel data-table-wrap"><table className="data-table"><thead><tr><th>Document</th><th>Prefix</th><th>Next number</th><th>Padding</th><th>Next document</th><th>Status</th></tr></thead><tbody>
          {sequences.map((sequence) => <tr key={sequence.id}><td><strong>{labels[sequence.document_type] ?? titleCase(sequence.document_type)}</strong><span>{sequence.document_type}</span></td><td><code>{sequence.prefix || "—"}</code></td><td><strong>{sequence.next_number.toLocaleString()}</strong></td><td>{sequence.padding}</td><td><code>{formatPreview(sequence)}</code></td><td><span className={sequence.is_active ? "status-pill active" : "status-pill"}>{sequence.is_active ? "Active" : "Inactive"}</span></td></tr>)}
        </tbody></table></div> : <div className="panel empty-state"><strong>No sequence rows have been created yet.</strong><span>Sequences are created automatically by the database when a supported document type is first posted.</span></div>}
      </section>
      <section className="settings-grid">
        <article className="settings-card"><div className="settings-card-top"><div><h3>Supported document types</h3><p>Document types with built-in defaults in the transactional sequence engine.</p></div><span className="settings-status ready">{supportedTypes.length} types</span></div><div className="settings-card-bottom"><span>{supportedTypes.map((type) => labels[type]).join(" · ")}</span></div></article>
        <article className="settings-card"><div className="settings-card-top"><div><h3>Why this is read-only</h3><p>Direct authenticated updates to sequence counters are intentionally blocked by the database.</p></div><span className="settings-status ready">Protected</span></div><div className="settings-card-bottom"><span>The internal sequence function locks the organization/document row, issues the current number, then increments the counter atomically.</span></div></article>
      </section>
      <section className="settings-note"><strong>Operational rule</strong><span>Never manually increment a sequence from the UI. The posting layer owns number allocation so concurrent users cannot receive the same document number.</span></section>
    </div>
  );
}