"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createExpenseCategory, deactivateExpenseCategory, updateExpenseCategory } from "@/lib/accounting/actions";
import { DataTable, FormActions, FormField, PageHeader, PageSection, Select, StatusBadge } from "@/components/ui";
import { getErrorMessage } from "@/lib/app/errors";

type Category = { id: string; category_code: string; name: string; expense_account_id: string; is_active: boolean };
type Account = { id: string; account_code: string; account_name: string; account_type: string; is_active: boolean; is_postable: boolean };

export function ExpenseCategories({ organizationId, categories, accounts }: { organizationId: string; categories: Category[]; accounts: Account[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ id: "", code: "", name: "", accountId: "", active: true });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const expenseAccounts = useMemo(() => accounts.filter((a) => a.account_type === "EXPENSE" && a.is_active && a.is_postable), [accounts]);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (!form.code.trim() || !form.name.trim() || !form.accountId) throw new Error("Code, name and expense account are required.");
      const payload = { category_code: form.code.trim(), name: form.name.trim(), expense_account_id: form.accountId, is_active: form.active };
      const client = createClient();
      if (form.id) await updateExpenseCategory(client, organizationId, form.id, payload);
      else await createExpenseCategory(client, organizationId, payload);
      setForm({ id: "", code: "", name: "", accountId: "", active: true });
      setMessage(form.id ? "Expense category updated." : "Expense category created.");
      router.refresh();
    } catch (cause) { setError(getErrorMessage(cause)); } finally { setBusy(false); }
  }

  async function deactivate(id: string) {
    setBusy(true); setError(""); setMessage("");
    try { await deactivateExpenseCategory(createClient(), organizationId, id); setMessage("Expense category deactivated."); router.refresh(); }
    catch (cause) { setError(getErrorMessage(cause)); } finally { setBusy(false); }
  }

  return <div className="page">
    <PageHeader eyebrow="Accounting / Setup" title="Expense Categories" description="Manage the expense categories and their required EXPENSE account mapping." />
    <PageSection title={form.id ? "Edit category" : "New category"}>
      <form className="ui-form-grid" onSubmit={save}>
        <FormField label="Code" htmlFor="category-code" required><input id="category-code" className="ui-input" value={form.code} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} /></FormField>
        <FormField label="Name" htmlFor="category-name" required><input id="category-name" className="ui-input" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} /></FormField>
        <FormField label="Expense account" htmlFor="expense-account" required><Select id="expense-account" value={form.accountId} onChange={(e) => setForm((v) => ({ ...v, accountId: e.target.value }))}><option value="">Select EXPENSE account</option>{expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}</Select></FormField>
        {form.id ? <FormField label="Lifecycle" htmlFor="category-active"><label className="ui-check"><input id="category-active" type="checkbox" checked={form.active} onChange={(e) => setForm((v) => ({ ...v, active: e.target.checked }))} /> Active</label></FormField> : null}
        {message ? <p className="ui-field-hint">{message}</p> : null}{error ? <p className="ui-field-error" role="alert">{error}</p> : null}
        <FormActions><button className="button primary" disabled={busy} type="submit">{busy ? "Saving…" : form.id ? "Save category" : "Create category"}</button>{form.id ? <button className="button" type="button" disabled={busy} onClick={() => setForm({ id: "", code: "", name: "", accountId: "", active: true })}>Cancel</button> : null}</FormActions>
      </form>
    </PageSection>
    <PageSection title="Categories">
      <DataTable rows={categories} columns={[
        { key: "code", header: "Code", render: (r) => r.category_code },
        { key: "name", header: "Name", render: (r) => r.name },
        { key: "account", header: "Expense account", render: (r) => accounts.find((a) => a.id === r.expense_account_id)?.account_name ?? "Missing account" },
        { key: "status", header: "Status", render: (r) => <StatusBadge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</StatusBadge> },
        { key: "actions", header: "Actions", render: (r) => r.is_active ? <><button className="button" type="button" onClick={() => setForm({ id: r.id, code: r.category_code, name: r.name, accountId: r.expense_account_id, active: r.is_active })}>Edit</button><button className="button" type="button" disabled={busy} onClick={() => deactivate(r.id)}>Deactivate</button></> : <span className="ui-field-hint">Inactive</span> },
      ]} empty="No expense categories found." />
    </PageSection>
  </div>;
}
