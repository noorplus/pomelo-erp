"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createOpeningBalance } from "@/lib/accounting/actions";
import { DataTable, FormActions, FormField, PageHeader, PageSection, Select, StatusBadge } from "@/components/ui";

type Account = { id: string; account_code: string; account_name: string; account_type: string; normal_balance: string; is_active: boolean; is_postable: boolean };
type Period = { id: string; name: string; start_date: string; end_date: string; status: string };
type Entry = { id: string; entry_number: string | null; accounting_period_id: string; entry_date: string; status: string; description: string | null };

export function OpeningBalance({ organizationId, accounts, periods, entries }: { organizationId: string; accounts: Account[]; periods: Period[]; entries: Entry[] }) {
  const router = useRouter();
  const openPeriods = periods.filter((p) => p.status === "OPEN");
  const [periodId, setPeriodId] = useState(openPeriods[0]?.id ?? "");
  const period = periods.find((p) => p.id === periodId);
  const [date, setDate] = useState(period?.start_date ?? "");
  const [values, setValues] = useState<Record<string, { debit: string; credit: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const postable = useMemo(() => accounts.filter((a) => a.is_active && a.is_postable), [accounts]);
  const existing = entries.find((e) => e.accounting_period_id === periodId && e.status === "CONFIRMED");
  const totals = postable.reduce((x, a) => {
    const v = values[a.id] ?? { debit: "", credit: "" };
    return { debit: x.debit + Number(v.debit || 0), credit: x.credit + Number(v.credit || 0) };
  }, { debit: 0, credit: 0 });
  const difference = totals.debit - totals.credit;

  function setValue(id: string, side: "debit" | "credit", value: string) {
    setValues((current) => ({ ...current, [id]: { ...(current[id] ?? { debit: "", credit: "" }), [side]: value, ...(side === "debit" && value ? { credit: "" } : {}), ...(side === "credit" && value ? { debit: "" } : {}) } }));
  }

  function selectPeriod(id: string) {
    const p = periods.find((x) => x.id === id);
    setPeriodId(id); setDate(p?.start_date ?? ""); setValues({}); setError(""); setMessage("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (!period || period.status !== "OPEN") throw new Error("Select an open accounting period.");
      if (!date || date < period.start_date || date > period.end_date) throw new Error("Opening date must be inside the selected period.");
      if (existing) throw new Error("This accounting period already has a confirmed opening journal.");
      if (Math.abs(difference) > 0.000001) throw new Error("Opening balance must balance: total debit and total credit must be equal.");
      const lines = postable.map((a) => {
        const v = values[a.id] ?? { debit: "", credit: "" };
        return { account_id: a.id, debit: Number(v.debit || 0), credit: Number(v.credit || 0) };
      }).filter((x) => x.debit > 0 || x.credit > 0);
      if (lines.length < 2) throw new Error("Enter opening balances for at least two accounts.");
      await createOpeningBalance(createClient(), organizationId, { accountingPeriodId: period.id, entryDate: date, lines });
      setValues({}); setMessage("Opening balance posted successfully."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to post opening balance."); }
    finally { setBusy(false); }
  }

  return <div className="page">
    <PageHeader eyebrow="Accounting / Setup" title="Opening Balance" description="Initialize the opening position using a confirmed OPENING journal. The frozen database remains unchanged." />
    <PageSection title="Opening setup">
      <form className="ui-form-grid" onSubmit={save}>
        <FormField label="Accounting period" htmlFor="opening-period" required><Select id="opening-period" value={periodId} onChange={(e) => selectPeriod(e.target.value)}><option value="">Select open period</option>{openPeriods.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.start_date} → {p.end_date}</option>)}</Select></FormField>
        <FormField label="Opening date" htmlFor="opening-date" required><input id="opening-date" className="ui-input" type="date" value={date} min={period?.start_date} max={period?.end_date} onChange={(e) => setDate(e.target.value)} /></FormField>
        {existing ? <p className="ui-field-hint">Opening journal {existing.entry_number ?? existing.id} is already confirmed for this period.</p> : null}
        <div className="ui-form-full">
          <DataTable rows={postable} columns={[
            { key: "account", header: "Account", render: (a) => a.account_code + " — " + a.account_name },
            { key: "class", header: "Class", render: (a) => a.account_type },
            { key: "normal", header: "Normal", render: (a) => a.normal_balance },
            { key: "debit", header: "Opening debit", render: (a) => <input className="ui-input" type="number" min="0" step="0.01" value={values[a.id]?.debit ?? ""} disabled={Boolean(existing)} onChange={(e) => setValue(a.id, "debit", e.target.value)} /> },
            { key: "credit", header: "Opening credit", render: (a) => <input className="ui-input" type="number" min="0" step="0.01" value={values[a.id]?.credit ?? ""} disabled={Boolean(existing)} onChange={(e) => setValue(a.id, "credit", e.target.value)} /> },
          ]} empty="No postable accounts found." />
        </div>
        <div className="ui-detail-grid">
          <div><span>Total debit</span><strong>{totals.debit.toFixed(2)}</strong></div>
          <div><span>Total credit</span><strong>{totals.credit.toFixed(2)}</strong></div>
          <div><span>Difference</span><strong>{difference.toFixed(2)}</strong></div>
        </div>
        {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
        {message ? <p className="ui-field-hint">{message}</p> : null}
        <FormActions><button className="button primary" type="submit" disabled={busy || Boolean(existing)}>{busy ? "Posting…" : existing ? "Opening already posted" : "Post opening balance"}</button></FormActions>
      </form>
    </PageSection>
    <PageSection title="Opening journals">
      <DataTable rows={entries} columns={[
        { key: "entry", header: "Entry", render: (e) => e.entry_number ?? "—" },
        { key: "date", header: "Date", render: (e) => e.entry_date },
        { key: "period", header: "Period", render: (e) => periods.find((p) => p.id === e.accounting_period_id)?.name ?? "—" },
        { key: "status", header: "Status", render: (e) => <StatusBadge tone={e.status === "CONFIRMED" ? "success" : "danger"}>{e.status}</StatusBadge> },
      ]} empty="No opening journals found." />
    </PageSection>
  </div>;
}
