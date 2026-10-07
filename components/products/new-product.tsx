"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createProduct } from "@/lib/products/actions";
import { Form, FormActions, FormField, PageHeader, PageSection, Select } from "@/components/ui";
import { getErrorMessage } from "@/lib/app/errors";

type Unit = { id: string; name: string; is_active: boolean };
type Account = { id: string; account_code: string; account_name: string; account_type: string; is_postable: boolean; is_active: boolean };

export function NewProduct({ org, units, accounts }: { org: string; units: Unit[]; accounts: Account[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [inventoryAccountId, setInventoryAccountId] = useState("");
  const [salesAccountId, setSalesAccountId] = useState("");
  const [cogsAccountId, setCogsAccountId] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim() || !unitId || !inventoryAccountId || !salesAccountId || !cogsAccountId) {
      setError("Name, unit and all three accounting accounts are required.");
      return;
    }
    setBusy(true);
    try {
      const created = await createProduct(createClient(), org, {
        product_code: null,
        name: name.trim(),
        unit_id: unitId,
        inventory_account_id: inventoryAccountId,
        sales_account_id: salesAccountId,
        cogs_account_id: cogsAccountId,
        is_active: active,
      });
      router.push("/products?created=" + encodeURIComponent(created.product_code ?? ""));
      router.refresh();
    } catch (cause) {
      setError(getErrorMessage(cause));
      setBusy(false);
    }
  }

  return <div className="page">
    <PageHeader eyebrow="Products" title="New product" description="Create a product using the fields supported by the frozen database." actions={<Link className="button" href="/products"><ArrowLeft size={16} /> Products</Link>} />
    <PageSection title="Product information" description="The product code is generated automatically by the database when the product is saved.">
      <Form onSubmit={submit}>
        <FormField label="Product code" htmlFor="product-code"><input id="product-code" className="ui-input" value="Generated automatically on save" readOnly /></FormField>
        <FormField label="Name" htmlFor="product-name" required><input id="product-name" className="ui-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required /></FormField>
        <FormField label="Unit" htmlFor="product-unit" required><Select id="product-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}><option value="">Select unit</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></FormField>
        {[[inventoryAccountId,setInventoryAccountId,"Inventory account"],[salesAccountId,setSalesAccountId,"Sales account"],[cogsAccountId,setCogsAccountId,"COGS account"]].map(([value,setValue,label]) => <FormField key={label as string} label={label as string} htmlFor={"product-" + (label as string).toLowerCase().replaceAll(" ","-")} required><Select id={"product-" + (label as string).toLowerCase().replaceAll(" ","-")} value={value as string} onChange={(e) => (setValue as (v:string)=>void)(e.target.value)}><option value="">Select account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name} ({a.account_type})</option>)}</Select></FormField>)}
        <FormField label="Lifecycle" htmlFor="product-active"><label className="ui-check"><input id="product-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label></FormField>
        {error ? <p className="ui-field-error">{error}</p> : null}
        <FormActions><button className="button primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create product"}</button><Link className="button" href="/products">Cancel</Link></FormActions>
      </Form>
    </PageSection>
  </div>;
}
