"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createUnit, updateUnit, createProduct, updateProduct } from "@/lib/master-data/actions";
import { DataTable, FormActions, FormField, PageHeader, PageSection, SearchInput, Select, StatusBadge } from "@/components/ui";
import { getErrorMessage } from "@/lib/app/errors";
import type { Tables } from "@/lib/supabase/database";

type Unit = Tables<"units_of_measure">;
type Product = Tables<"products">;
type NumberSequence = Tables<"number_sequences">;
type Account = { id: string; account_code: string; account_name: string; account_type: string; is_postable: boolean; is_active: boolean };

function Units({ org, rows }: { org: string; rows: Unit[] }) {
  const r = useRouter();
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!name.trim()) throw new Error("Unit name is required.");
      if (edit) await updateUnit(createClient(), org, edit, { name: name.trim() });
      else await createUnit(createClient(), org, name.trim());
      setName("");
      setEdit(null);
      r.refresh();
    } catch (x) {
      setError(getErrorMessage(x));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageSection title={edit ? "Edit unit" : "New unit"}>
      <form onSubmit={save} className="ui-member-form">
        <FormField label="Name" htmlFor="unit-name" required>
          <input id="unit-name" className="ui-input" value={name} onChange={e => setName(e.target.value)} />
        </FormField>
        <button className="button primary" disabled={busy}>{edit ? "Save" : "Add unit"}</button>
      </form>
      {error ? <p className="ui-field-error">{error}</p> : null}
    </PageSection>
    <PageSection title="Units">
      <DataTable rows={rows} columns={[
        { key: "name", header: "Name", render: u => u.name },
        { key: "status", header: "Status", render: u => <StatusBadge tone={u.is_active ? "success" : "neutral"}>{u.is_active ? "Active" : "Inactive"}</StatusBadge> },
        { key: "action", header: "Action", render: u => <button className="button" type="button" onClick={() => { setEdit(u.id); setName(u.name); }}>Edit</button> },
      ]} empty="No units found." />
    </PageSection>
  </>;
}

function Products({ org, rows, units, accounts }: { org: string; rows: Product[]; units: Unit[]; accounts: Account[] }) {
  const r = useRouter();
  const blank = { id: "", code: "", name: "", unit: "", inventory: "", sales: "", cogs: "", active: true };
  const [f, setF] = useState(blank);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = accounts.filter(a => a.is_postable && a.is_active);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!f.name.trim() || !f.unit || !f.inventory || !f.sales || !f.cogs) throw new Error("Name, unit and all three accounts are required.");
      const p = { product_code: f.id ? f.code : null, name: f.name.trim(), unit_id: f.unit, inventory_account_id: f.inventory, sales_account_id: f.sales, cogs_account_id: f.cogs, is_active: f.active };
      if (f.id) await updateProduct(createClient(), org, f.id, p);
      else await createProduct(createClient(), org, p);
      setF(blank);
      r.refresh();
    } catch (x) {
      setError(getErrorMessage(x));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageSection title={f.id ? "Edit product" : "New product"}>
      <form onSubmit={save} className="ui-form-grid">
        <FormField label="Product code" htmlFor="product-code">
          <input id="product-code" className="ui-input" value={f.id ? f.code : "Generated automatically on save"} readOnly />
        </FormField>
        <FormField label="Name" htmlFor="product-name" required>
          <input id="product-name" className="ui-input" value={f.name} onChange={e => setF(v => ({ ...v, name: e.target.value }))} />
        </FormField>
        <FormField label="Unit" htmlFor="product-unit" required>
          <Select id="product-unit" value={f.unit} onChange={e => setF(v => ({ ...v, unit: e.target.value }))}><option value="">Select unit</option>{units.filter(u => u.is_active).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        </FormField>
        {[["inventory", "Inventory account"], ["sales", "Sales account"], ["cogs", "COGS account"]].map(([key, labelText]) => (
          <FormField key={key} label={labelText} htmlFor={"product-" + key} required>
            <Select id={"product-" + key} value={f[key as keyof typeof f] as string} onChange={e => setF(v => ({ ...v, [key]: e.target.value }))}><option value="">Select account</option>{options.map(a => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}</Select>
          </FormField>
        ))}
        <FormField label="Lifecycle" htmlFor="product-active">
          <label className="ui-check"><input id="product-active" type="checkbox" checked={f.active} onChange={e => setF(v => ({ ...v, active: e.target.checked }))} /> Active</label>
        </FormField>
        <p className="ui-field-error">{error}</p>
        <FormActions>
          <button className="button primary" disabled={busy}>{f.id ? "Save product" : "Create product"}</button>
          {f.id ? <button className="button" type="button" onClick={() => setF(blank)}>Cancel</button> : null}
        </FormActions>
      </form>
    </PageSection>
    <PageSection title="Products" actions={<SearchInput value={q} onChange={setQ} placeholder="Search products" />}>
      <DataTable rows={rows.filter(p => !q.trim() || [p.product_code ?? "", p.name].some(v => v.toLowerCase().includes(q.toLowerCase().trim())))} columns={[
        { key: "code", header: "Code", render: p => <Link href={`/products/${p.id}`}>{p.product_code ?? "—"}</Link> },
        { key: "name", header: "Name", render: p => <a href={`/products/${p.id}`}>{p.name}</a> },
        { key: "unit", header: "Unit", render: p => units.find(u => u.id === p.unit_id)?.name ?? "—" },
        { key: "status", header: "Status", render: p => <StatusBadge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "Active" : "Inactive"}</StatusBadge> },
        { key: "action", header: "Action", render: p => <button className="button" type="button" onClick={() => setF({ id: p.id, code: p.product_code ?? "", name: p.name, unit: p.unit_id, inventory: p.inventory_account_id, sales: p.sales_account_id, cogs: p.cogs_account_id, active: p.is_active })}>Edit</button> },
      ]} empty="No products found." />
    </PageSection>
  </>;
}

function NumberSequences({ rows }: { rows: NumberSequence[] }) {
  const preview = (row: NumberSequence) => row.prefix + String(row.next_number).padStart(row.padding, "0");
  return <PageSection title="Number sequences" description="System-managed numbering for master data and transactions. These values are read-only.">
    <DataTable rows={rows} columns={[
      { key: "document_type", header: "Document", render: row => row.document_type },
      { key: "prefix", header: "Prefix", render: row => row.prefix },
      { key: "next_number", header: "Next number", render: row => row.next_number.toString() },
      { key: "padding", header: "Padding", render: row => row.padding.toString() },
      { key: "preview", header: "Next generated", render: row => preview(row) },
      { key: "status", header: "Status", render: row => <StatusBadge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Active" : "Inactive"}</StatusBadge> },
    ]} empty="No number sequences found." />
  </PageSection>;
}

export function MasterData({ org, units, products, accounts, numberSequences }: { org: string; units: Unit[]; products: Product[]; accounts: Account[]; numberSequences: NumberSequence[] }) {
  return <div className="page">
    <PageHeader eyebrow="Master data" title="Master data" description="Manage units and products using only the existing frozen database fields." />
    <Units org={org} rows={units} />
    <Products org={org} rows={products} units={units} accounts={accounts} />
    <NumberSequences rows={numberSequences} />
  </div>;
}
