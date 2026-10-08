"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createProduct, updateProduct } from "@/lib/products/actions";
import type { Tables } from "@/lib/supabase/database";

type Product = Tables<"products">;
import { FormActions, FormField, PageHeader, PageSection, Select } from "@/components/ui";
import { getErrorMessage } from "@/lib/app/errors";

type Unit = { id: string; name: string; is_active: boolean };
type Account = { id: string; account_code: string; account_name: string; account_type: string; is_postable: boolean; is_active: boolean };

export function NewProduct({ org, units, accounts, product }: { org: string; units: Unit[]; accounts: Account[]; product?: Product | null }) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [unitId, setUnitId] = useState(product?.unit_id ?? "");
  const [inventoryAccountId, setInventoryAccountId] = useState(product?.inventory_account_id ?? "");
  const [salesAccountId, setSalesAccountId] = useState(product?.sales_account_id ?? "");
  const [cogsAccountId, setCogsAccountId] = useState(product?.cogs_account_id ?? "");
  const [active, setActive] = useState(product?.is_active ?? true);
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
      if (product) {
        await updateProduct(createClient(), org, product.id, {
          product_code: product.product_code, name: name.trim(), unit_id: unitId, inventory_account_id: inventoryAccountId, sales_account_id: salesAccountId, cogs_account_id: cogsAccountId, is_active: active,
        });
        router.push(`/products/${product.id}`);
        router.refresh();
        return;
      }
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
    <PageHeader eyebrow="Products" title={product ? "Edit product" : "New product"} description={product ? "Update the product fields supported by the frozen database." : "Create a product using the fields supported by the frozen database."} actions={<Link className="button" href={product ? `/products/${product.id}` : "/products"}><ArrowLeft size={16} /> {product ? "Product" : "Products"}</Link>} />
    <PageSection title="Product information" description="The product code is generated automatically by the database when the product is saved.">
      <form className="ui-form-grid" onSubmit={submit}>
        <FormField label="Product code" htmlFor="product-code"><input id="product-code" className="ui-input" value={product?.product_code ?? "Generated automatically on save"} readOnly /></FormField>
        <FormField label="Name" htmlFor="product-name" required><input id="product-name" className="ui-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required /></FormField>
        <FormField label="Unit" htmlFor="product-unit" required><Select id="product-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}><option value="">Select unit</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></FormField>
        {[[inventoryAccountId,setInventoryAccountId,"Inventory account"],[salesAccountId,setSalesAccountId,"Sales account"],[cogsAccountId,setCogsAccountId,"COGS account"]].map(([value,setValue,label]) => <FormField key={label as string} label={label as string} htmlFor={"product-" + (label as string).toLowerCase().replaceAll(" ","-")} required><Select id={"product-" + (label as string).toLowerCase().replaceAll(" ","-")} value={value as string} onChange={(e) => (setValue as (v:string)=>void)(e.target.value)}><option value="">Select account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name} ({a.account_type})</option>)}</Select></FormField>)}
        <FormField label="Lifecycle" htmlFor="product-active"><label className="ui-check"><input id="product-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label></FormField>
        {error ? <p className="ui-field-error">{error}</p> : null}
        <FormActions><button className="button primary" type="submit" disabled={busy}>{busy ? "Saving…" : product ? "Save product" : "Create product"}</button><Link className="button" href="/products">Cancel</Link></FormActions>
      </form>
    </PageSection>
  </div>;
}
