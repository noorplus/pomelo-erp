/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  cancelExpense, cancelJournalEntry, cancelPayment, confirmExpense, confirmJournalEntry, confirmPayment,
  createExpense, createJournalEntry, createPayment,
} from "@/lib/accounting/actions";
import { DataTable, FormActions, FormField, PageHeader, PageSection, Select, StatusBadge } from "@/components/ui";

type Account = { id: string; account_code: string; account_name: string; account_type: string; is_active: boolean; is_postable: boolean };
type Contact = { id: string; contact_number: string | null; name: string; is_active: boolean };
type Period = { id: string; name: string; start_date: string; end_date: string; status: string };
type Category = { id: string; category_code: string; name: string; expense_account_id: string; is_active: boolean };
type Line = { accountId: string; debit: string; credit: string };
type Mode = "journal" | "payments" | "expenses";

const today = () => new Date().toISOString().slice(0, 10);
const tone = (s: string) => s === "CONFIRMED" ? "success" : s === "CANCELLED" ? "danger" : "neutral";

export function AccountingTransactions({
  mode, organizationId, rows, accounts, contacts, periods, categories,
}: {
  mode: Mode; organizationId: string; rows: any[]; accounts: Account[]; contacts: Contact[]; periods: Period[]; categories: Category[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: today(), periodId: periods.find((p) => p.status === "OPEN")?.id ?? "",
    type: mode === "payments" ? "RECEIPT" : "ADJUSTMENT", description: "", amount: "",
    contactId: "", accountId: "", settlementAccountId: "", categoryId: "", payableAccountId: "",
    lines: [{ accountId: "", debit: "", credit: "" }] as Line[],
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((x) => ({ ...x, [key]: value }));
  const openPeriods = periods.filter((p) => p.status === "OPEN");
  const selectedPeriod = periods.find((p) => p.id === form.periodId);
  const activePostable = accounts.filter((a) => a.is_active && a.is_postable);
  const activeAssets = activePostable.filter((a) => a.account_type === "ASSET");
  const activeLiabilities = activePostable.filter((a) => a.account_type === "LIABILITY");
  const paymentAccounts = form.type === "PAYMENT" ? activeLiabilities : activeAssets;

  function dateInOpenPeriod(date: string) {
    return openPeriods.some((p) => date >= p.start_date && date <= p.end_date);
  }

  function updateLine(index: number, patch: Partial<Line>) {
    set("lines", form.lines.map((line, i) => i === index ? { ...line, ...patch } : line));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (!dateInOpenPeriod(form.date)) throw new Error("The date must fall inside an open accounting period.");
      const client = createClient();

      if (mode === "journal") {
        if (!selectedPeriod || selectedPeriod.status !== "OPEN") throw new Error("Select an open accounting period.");
        if (!form.date || form.date < selectedPeriod.start_date || form.date > selectedPeriod.end_date) throw new Error("Entry date must be inside the selected accounting period.");
        const lines = form.lines.filter((x) => x.accountId || x.debit || x.credit).map((x) => ({
          account_id: x.accountId, debit: Number(x.debit || 0), credit: Number(x.credit || 0), description: form.description || null, contact_id: null,
        }));
        if (lines.length < 2) throw new Error("A journal entry needs at least two lines.");
        if (lines.some((line) => !line.account_id || (line.debit > 0 && line.credit > 0) || (line.debit === 0 && line.credit === 0))) throw new Error("Each journal line must have one postable account and either a debit or a credit amount.");
        const debit = lines.reduce((sum, line) => sum + line.debit, 0);
        const credit = lines.reduce((sum, line) => sum + line.credit, 0);
        if (debit <= 0 || Math.abs(debit - credit) > 0.000001) throw new Error("Journal entry debits and credits must balance.");
        await createJournalEntry(client, organizationId, {
          organization_id: organizationId, entry_number: null, accounting_period_id: form.periodId, entry_date: form.date,
          entry_type: form.type as "OPENING" | "ADJUSTMENT" | "OTHER", status: "DRAFT",
          reference_type: null, reference_id: null, description: form.description || null, posted_at: null, reversal_of_id: null, created_by: null,
        }, lines);
      } else if (mode === "payments") {
        const amount = Number(form.amount);
        if (amount <= 0) throw new Error("Payment amount must be greater than zero.");
        if (!form.accountId || !form.settlementAccountId) throw new Error("Both payment and settlement accounts are required.");
        if (form.accountId === form.settlementAccountId) throw new Error("Payment and settlement accounts must be different.");
        await createPayment(client, organizationId, {
          organization_id: organizationId, payment_number: null, payment_type: form.type as "RECEIPT" | "PAYMENT",
          contact_id: form.contactId || null, payment_date: form.date, amount, account_id: form.accountId,
          settlement_account_id: form.settlementAccountId, status: "DRAFT", posted_journal_entry_id: null,
          description: form.description || null, created_by: null,
        });
      } else {
        const amount = Number(form.amount);
        if (amount <= 0) throw new Error("Expense amount must be greater than zero.");
        if (!form.categoryId || !form.payableAccountId) throw new Error("Expense category and payable account are required.");
        await createExpense(client, organizationId, {
          organization_id: organizationId, expense_number: null, expense_category_id: form.categoryId,
          contact_id: form.contactId || null, payable_account_id: form.payableAccountId, expense_date: form.date,
          amount, description: form.description || null, status: "DRAFT", posted_journal_entry_id: null, created_by: null,
        });
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save.");
    } finally { setBusy(false); }
  }

  async function changeStatus(id: string, action: "confirm" | "cancel") {
    setBusy(true); setError("");
    try {
      const client = createClient();
      if (mode === "journal") action === "confirm" ? await confirmJournalEntry(client, id) : await cancelJournalEntry(client, id);
      else if (mode === "payments") action === "confirm" ? await confirmPayment(client, id) : await cancelPayment(client, id);
      else action === "confirm" ? await confirmExpense(client, id) : await cancelExpense(client, id);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update status.");
    } finally { setBusy(false); }
  }

  const title = mode === "journal" ? "Journal Entries" : mode === "payments" ? "Payments" : "Expenses";
  const columns = mode === "journal"
    ? [
        { key: "entry_number", header: "Entry", render: (r: any) => <Link href={"/accounting/transactions/journal-entries/" + r.id}>{r.entry_number || "Draft"}</Link> },
        { key: "entry_date", header: "Date", render: (r: any) => r.entry_date },
        { key: "entry_type", header: "Type", render: (r: any) => r.entry_type },
        { key: "status", header: "Status", render: (r: any) => <StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge> },
        { key: "description", header: "Description", render: (r: any) => r.description || "—" },
        { key: "actions", header: "Actions", render: (r: any) => r.status === "DRAFT" ? <><button className="button" type="button" disabled={busy} onClick={() => changeStatus(r.id, "confirm")}>Confirm</button><button className="button" type="button" disabled={busy} onClick={() => changeStatus(r.id, "cancel")}>Cancel</button></> : null },
      ]
    : mode === "payments"
      ? [
          { key: "payment_number", header: "Payment", render: (r: any) => r.payment_number || "Draft" },
          { key: "payment_date", header: "Date", render: (r: any) => r.payment_date },
          { key: "payment_type", header: "Type", render: (r: any) => r.payment_type },
          { key: "amount", header: "Amount", render: (r: any) => Number(r.amount).toFixed(2) },
          { key: "status", header: "Status", render: (r: any) => <StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge> },
          { key: "allocation", header: "Allocation", render: (r: any) => <Link href={"/accounting/transactions/payments/" + r.id}>Manage</Link> },
          { key: "actions", header: "Actions", render: (r: any) => r.status === "DRAFT" ? <><button className="button" type="button" disabled={busy} onClick={() => changeStatus(r.id, "confirm")}>Confirm</button><button className="button" type="button" disabled={busy} onClick={() => changeStatus(r.id, "cancel")}>Cancel</button></> : null },
        ]
      : [
          { key: "expense_number", header: "Expense", render: (r: any) => r.expense_number || "Draft" },
          { key: "expense_date", header: "Date", render: (r: any) => r.expense_date },
          { key: "amount", header: "Amount", render: (r: any) => Number(r.amount).toFixed(2) },
          { key: "status", header: "Status", render: (r: any) => <StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge> },
          { key: "description", header: "Description", render: (r: any) => r.description || "—" },
          { key: "actions", header: "Actions", render: (r: any) => r.status === "DRAFT" ? <><button className="button" type="button" disabled={busy} onClick={() => changeStatus(r.id, "confirm")}>Confirm</button><button className="button" type="button" disabled={busy} onClick={() => changeStatus(r.id, "cancel")}>Cancel</button></> : null },
        ];

  return <div className="page">
    <PageHeader eyebrow="Accounting / Transactions" title={title} description="Database-backed transaction workflow using only supported frozen-database values." />
    <PageSection title={mode === "journal" ? "New journal entry" : "New transaction"}>
      <form className="ui-form-grid" onSubmit={save}>
        {mode === "journal" ? <>
          <FormField label="Accounting period" htmlFor="period" required><Select id="period" value={form.periodId} onChange={(e) => set("periodId", e.target.value)}><option value="">Select open period</option>{openPeriods.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.start_date} → {p.end_date}</option>)}</Select></FormField>
          <FormField label="Entry date" htmlFor="date" required><input id="date" className="ui-input" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></FormField>
          <FormField label="Entry type" htmlFor="type" required><Select id="type" value={form.type} onChange={(e) => set("type", e.target.value)}><option value="OPENING">OPENING</option><option value="ADJUSTMENT">ADJUSTMENT</option><option value="OTHER">OTHER</option></Select></FormField>
          <FormField label="Description" htmlFor="description"><input id="description" className="ui-input" value={form.description} onChange={(e) => set("description", e.target.value)} /></FormField>
          <div className="ui-form-full"><strong>Journal lines</strong>{form.lines.map((line, i) => <div className="ui-form-grid" key={i}>
            <FormField label={"Account " + (i + 1)} htmlFor={"account-" + i} required><Select id={"account-" + i} value={line.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })}><option value="">Select postable account</option>{activePostable.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}</Select></FormField>
            <FormField label="Debit" htmlFor={"debit-" + i}><input id={"debit-" + i} className="ui-input" min="0" step="0.01" type="number" value={line.debit} onChange={(e) => updateLine(i, { debit: e.target.value, credit: e.target.value ? "" : line.credit })} /></FormField>
            <FormField label="Credit" htmlFor={"credit-" + i}><input id={"credit-" + i} className="ui-input" min="0" step="0.01" type="number" value={line.credit} onChange={(e) => updateLine(i, { credit: e.target.value, debit: e.target.value ? "" : line.debit })} /></FormField>
            {form.lines.length > 2 ? <button className="button" type="button" onClick={() => set("lines", form.lines.filter((_, j) => j !== i))}>Remove line</button> : null}
          </div>)}<button type="button" className="button" onClick={() => set("lines", [...form.lines, { accountId: "", debit: "", credit: "" }])}>Add line</button></div>
        </> : mode === "payments" ? <>
          <FormField label="Payment type" htmlFor="type" required><Select id="type" value={form.type} onChange={(e) => set("type", e.target.value)}><option value="RECEIPT">RECEIPT</option><option value="PAYMENT">PAYMENT</option></Select></FormField>
          <FormField label="Date" htmlFor="date" required><input id="date" className="ui-input" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></FormField>
          <FormField label="Contact" htmlFor="contact"><Select id="contact" value={form.contactId} onChange={(e) => set("contactId", e.target.value)}><option value="">No contact</option>{contacts.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.contact_number ? c.contact_number + " — " : ""}{c.name}</option>)}</Select></FormField>
          <FormField label={form.type === "PAYMENT" ? "Counterparty liability account" : "Counterparty receivable account"} htmlFor="account" required><Select id="account" value={form.accountId} onChange={(e) => set("accountId", e.target.value)}><option value="">Select account</option>{paymentAccounts.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}</Select></FormField>
          <FormField label="Settlement account (asset)" htmlFor="settlement" required><Select id="settlement" value={form.settlementAccountId} onChange={(e) => set("settlementAccountId", e.target.value)}><option value="">Select asset account</option>{activeAssets.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}</Select></FormField>
          <FormField label="Amount" htmlFor="amount" required><input id="amount" className="ui-input" min="0.01" step="0.01" type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></FormField>
          <FormField label="Description" htmlFor="description"><input id="description" className="ui-input" value={form.description} onChange={(e) => set("description", e.target.value)} /></FormField>
        </> : <>
          <FormField label="Expense date" htmlFor="date" required><input id="date" className="ui-input" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></FormField>
          <FormField label="Expense category" htmlFor="category" required><Select id="category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}><option value="">Select active category</option>{categories.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.category_code} — {c.name}</option>)}</Select></FormField>
          <FormField label="Contact" htmlFor="contact"><Select id="contact" value={form.contactId} onChange={(e) => set("contactId", e.target.value)}><option value="">No contact</option>{contacts.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.contact_number ? c.contact_number + " — " : ""}{c.name}</option>)}</Select></FormField>
          <FormField label="Payable account (liability)" htmlFor="payable" required><Select id="payable" value={form.payableAccountId} onChange={(e) => set("payableAccountId", e.target.value)}><option value="">Select liability account</option>{activeLiabilities.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}</Select></FormField>
          <FormField label="Amount" htmlFor="amount" required><input id="amount" className="ui-input" min="0.01" step="0.01" type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></FormField>
          <FormField label="Description" htmlFor="description"><input id="description" className="ui-input" value={form.description} onChange={(e) => set("description", e.target.value)} /></FormField>
        </>}
        {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
        <FormActions><button className="button primary" disabled={busy} type="submit">{busy ? "Saving…" : "Create draft"}</button></FormActions>
      </form>
    </PageSection>
    <PageSection title={title}><DataTable rows={rows} columns={columns} empty={"No " + title.toLowerCase() + " found."} /></PageSection>
  </div>;
}
