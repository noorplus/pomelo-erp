"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createAccountingPeriod, closeAccountingPeriod } from "@/lib/accounting/actions";
import { Form, DataTable, FormActions, FormField, PageHeader, PageSection, StatusBadge } from "@/components/ui";
import { getErrorMessage } from "@/lib/app/errors";
import type { Tables } from "@/lib/supabase/database";

type Period = Tables<"accounting_periods">;

export function AccountingPeriods({ organizationId, periods }: { organizationId: string; periods: Period[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [busy, setBusy] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (!form.name.trim()) throw new Error("Period name is required.");
      if (!form.startDate || !form.endDate) throw new Error("Start and end dates are required.");
      if (form.startDate > form.endDate) throw new Error("Start date cannot be after end date.");
      await createAccountingPeriod(createClient(), { organizationId, name: form.name.trim(), startDate: form.startDate, endDate: form.endDate });
      setForm({ name: "", startDate: "", endDate: "" }); setMessage("Accounting period created."); router.refresh();
    } catch (cause) { setError(getErrorMessage(cause)); } finally { setBusy(false); }
  }

  async function close(id: string) {
    setClosingId(id); setError(""); setMessage("");
    try { await closeAccountingPeriod(createClient(), id); setMessage("Accounting period closed."); router.refresh(); }
    catch (cause) { setError(getErrorMessage(cause)); } finally { setClosingId(null); }
  }

  return <div className="page">
    <PageHeader eyebrow="Accounting" title="Accounting periods" description="Create and close periods through the frozen database lifecycle RPCs." />
    <PageSection title="New period">
      <Form onSubmit={create} className="ui-form-grid">
        <FormField label="Name" htmlFor="period-name" required><input id="period-name" className="ui-input" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder="FY 2026" /></FormField>
        <FormField label="Start date" htmlFor="period-start" required><input id="period-start" className="ui-input" type="date" value={form.startDate} onChange={e => setForm(v => ({ ...v, startDate: e.target.value }))} /></FormField>
        <FormField label="End date" htmlFor="period-end" required><input id="period-end" className="ui-input" type="date" value={form.endDate} onChange={e => setForm(v => ({ ...v, endDate: e.target.value }))} /></FormField>
        {message ? <p className="ui-field-hint">{message}</p> : null}{error ? <p className="ui-field-error" role="alert">{error}</p> : null}
        <FormActions><button className="button primary" disabled={busy} type="submit">{busy ? "Creating…" : "Create period"}</button></FormActions>
      </Form>
    </PageSection>
    <PageSection title="Periods">
      <DataTable rows={periods} columns={[
        { key: "name", header: "Name", render: p => p.name },
        { key: "dates", header: "Date range", render: p => <>{p.start_date} → {p.end_date}</> },
        { key: "status", header: "Status", render: p => <StatusBadge tone={p.status === "OPEN" ? "success" : "neutral"}>{p.status}</StatusBadge> },
        { key: "closed", header: "Closed", render: p => p.closed_at ? new Date(p.closed_at).toLocaleDateString() : "—" },
        { key: "action", header: "Action", render: p => p.status === "OPEN" ? <button className="button" disabled={closingId === p.id} type="button" onClick={() => close(p.id)}>{closingId === p.id ? "Closing…" : "Close period"}</button> : <span className="ui-field-hint">Closed</span> },
      ]} empty="No accounting periods yet." />
    </PageSection>
  </div>;
}
