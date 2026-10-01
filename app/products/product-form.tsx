"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveProduct, type ProductActionState } from "./actions";

type Option = { id: string; label: string };

type Product = {
  id: string;
  product_code: string;
  name: string;
  description: string | null;
  unit_id: string;
  inventory_account_id: string;
  sales_account_id: string;
  cogs_account_id: string;
};

const initialState: ProductActionState = {};

export function ProductForm({
  product,
  units,
  accounts,
}: {
  product?: Product | null;
  units: Option[];
  accounts: Option[];
}) {
  const [state, formAction, pending] = useActionState(saveProduct, initialState);

  return (
    <form action={formAction} className="erp-form">
      {product?.id ? <input type="hidden" name="id" value={product.id} /> : null}

      <div className="form-header">
        <div>
          <p className="eyebrow">{product ? "Edit product" : "New product"}</p>
          <h2>{product ? product.name : "Create product"}</h2>
        </div>
        {product ? <Link href="/products" className="secondary-button compact">Cancel</Link> : null}
      </div>

      <div className="form-grid">
        <label>
          Product code
          <input name="product_code" defaultValue={product?.product_code ?? ""} required />
        </label>

        <label>
          Product name
          <input name="name" defaultValue={product?.name ?? ""} required />
        </label>

        <label className="form-span-2">
          Description
          <textarea name="description" defaultValue={product?.description ?? ""} rows={3} />
        </label>

        <label>
          Unit of measure
          <select name="unit_id" defaultValue={product?.unit_id ?? ""} required>
            <option value="">Select unit</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
          </select>
        </label>

        <label>
          Inventory account
          <select name="inventory_account_id" defaultValue={product?.inventory_account_id ?? ""} required>
            <option value="">Select account</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
          </select>
        </label>

        <label>
          Sales account
          <select name="sales_account_id" defaultValue={product?.sales_account_id ?? ""} required>
            <option value="">Select account</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
          </select>
        </label>

        <label>
          COGS account
          <select name="cogs_account_id" defaultValue={product?.cogs_account_id ?? ""} required>
            <option value="">Select account</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
          </select>
        </label>
      </div>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.success ? <p className="form-success">{state.success}</p> : null}

      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Saving…" : product ? "Save changes" : "Create product"}
        </button>
      </div>
    </form>
  );
}
