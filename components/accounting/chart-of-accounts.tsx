"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createAccount, updateAccount, deactivateAccount } from "@/lib/accounting/actions";
import { DataTable, FormActions, FormField, PageHeader, PageSection, SearchInput, Select, StatusBadge } from "@/components/ui";
import { getErrorMessage } from "@/lib/app/errors";
import type { Tables } from "@/lib/supabase/database";

type Account = Tables<"accounts">;
type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
const accountTypes: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
const defaultBalances: Record<AccountType, "DEBIT" | "CREDIT"> = {
  ASSET: "DEBIT", LIABILITY: "CREDIT", EQUITY: "CREDIT", REVENUE: "CREDIT", EXPENSE: "DEBIT",
};

const blank = { id: "", code: "", name: "", type: "ASSET" as AccountType, balance: "DEBIT" as "DEBIT" | "CREDIT", parentId: "", control: false, postable: true, active: true };

export function ChartOfAccounts({ organizationId, accounts }: { organizationId: string; accounts: Account[] }) {
  const router = useRouter();
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const parentOptions = useMemo(() => accounts.filter(a => a.id !== form.id && a.is_active), [accounts, form.id]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? accounts.filter(a => [a.account_code, a.account_name, a.account_type].some(v => v.toLowerCase().includes(q))) : accounts;
  }, [accounts, search]);

  function setType(type: AccountType) {
    setForm(v => ({ ...v, type, balance: defaultBalances[type] }));
  }
  function edit(account: Account) {
    setError(""); setMessage("");
    setForm({ id: account.id, code: account.account_code, name: account.account_name, type: account.account_type as AccountType, balance: account.normal_balance as "DEBIT" | "CREDIT", parentId: account.parent_account_id ?? "", control: account.is_control_account, postable: account.is_postable, active: account.is_active });
  }
  function reset() { setForm(blank); setError(""); setMessage(""); }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (!form.code.trim() || !form.name.trim()) throw new Error("Account code and name are required.");
      if (!accountTypes.includes(form.type)) throw new Error("Select a valid account class.");
      const payload = { account_code: form.code.trim(), account_name: form.name.trim(), account_type: form.type, normal_balance: form.balance, parent_account_id: form.parentId || null, is_control_account: form.control, is_postable: form.postable, is_active: form.active };
      const client = createClient();
      if (form.id) await updateAccount(client, organizationId, form.id, payload);
      else await createAccount(client, organizationId, payload);
      setMessage(form.id ? "Account updated." : "Account created."); reset(); router.refresh();
    } catch (cause) { setError(getErrorMessage(cause)); } finally { setBusy(false); }
  }

  async function deactivate(id: string) {
    setBusy(true); setError(""); setMessage("");
    try { await deactivateAccount(createClient(), organizationId, id); setMessage("Account deactivated."); router.refresh(); }
    catch (cause) { setError(getErrorMessage(cause)); } finally { setBusy(false); }
  }

  return <div className="page">
    <PageHeader eyebrow="Accounting" title="Chart of accounts" description="Manage the organization chart using the existing account fields. “Class” maps directly to account_type; there is no separate class column." />
    <PageSection title={form.id ? "Edit account" : "New account"} description="System accounts are protected; they are initialized and managed by the database contract.">
      <form onSubmit={save} className="ui-form-grid">
        <FormField label="Code" htmlFor="account-code" required><input id="account-code" className="ui-input" value={form.code} onChange={e => setForm(v => ({ ...v, code: e.target.value }))} /></FormField>
        <FormField label="Name" htmlFor="account-name" required><input id="account-name" className="ui-input" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} /></FormField>
        <FormField label="Class" htmlFor="account-type" required><Select id="account-type" value={form.type} onChange={e => setType(e.target.value as AccountType)}>{accountTypes.map(t => <option key={t} value={t}>{t}</option>)}</Select></FormField>
        <FormField label="Normal balance" htmlFor="account-balance" required><Select id="account-balance" value={form.balance} onChange={e => setForm(v => ({ ...v, balance: e.target.value as "DEBIT" | "CREDIT" }))}><option value="DEBIT">Debit</option><option value="CREDIT">Credit</option></Select></FormField>
        <FormField label="Parent account" htmlFor="account-parent"><Select id="account-parent" value={form.parentId} onChange={e => setForm(v => ({ ...v, parentId: e.target.value }))}><option value="">No parent (root)</option>{parentOptions.map(a => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}</Select></FormField>
        <FormField label="Account behavior" htmlFor="account-control"><label className="ui-check"><input id="account-control" type="checkbox" checked={form.control} onChange={e => setForm(v => ({ ...v, control: e.target.checked }))} /> Control account</label><label className="ui-check"><input type="checkbox" checked={form.postable} onChange={e => setForm(v => ({ ...v, postable: e.target.checked }))} /> Postable</label></FormField>
        {form.id ? <FormField label="Lifecycle" htmlFor="account-active"><label className="ui-check"><input id="account-active" type="checkbox" checked={form.active} onChange={e => setForm(v => ({ ...v, active: e.target.checked }))} /> Active</label></FormField> : null}
        {message ? <p className="ui-field-hint">{message}</p> : null}{error ? <p className="ui-field-error" role="alert">{error}</p> : null}
        <FormActions><button className="button primary" disabled={busy} type="submit">{busy ? "Saving…" : form.id ? "Save account" : "Create account"}</button>{form.id ? <button className="button" disabled={busy} type="button" onClick={reset}>Cancel</button> : null}</FormActions>
      </form>
    </PageSection>
    <PageSection title="Accounts" actions={<SearchInput value={search} onChange={setSearch} placeholder="Search code, name or class" />}>
      <DataTable rows={filtered} columns={[
        { key: "code", header: "Code", render: a => a.account_code },
        { key: "name", header: "Name", render: a => <>{a.account_name}{a.is_system_account ? <span className="ui-field-hint"> · System</span> : null}</> },
        { key: "type", header: "Class", render: a => a.account_type },
        { key: "balance", header: "Normal", render: a => a.normal_balance },
        { key: "parent", header: "Parent", render: a => accounts.find(p => p.id === a.parent_account_id)?.account_name ?? "—" },
        { key: "status", header: "Status", render: a => <StatusBadge tone={a.is_active ? "success" : "neutral"}>{a.is_active ? "Active" : "Inactive"}</StatusBadge> },
        { key: "action", header: "Action", render: a => a.is_system_account ? <span className="ui-field-hint">Protected</span> : <>{<button className="button" type="button" onClick={() => edit(a)}>Edit</button>}{a.is_active ? <button className="button" type="button" onClick={() => deactivate(a.id)} disabled={busy}>Deactivate</button> : null}</> },
      ]} empty="No accounts found." />
    </PageSection>
  </div>;
}
