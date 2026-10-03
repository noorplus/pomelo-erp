"use client";

import { useState, useTransition } from "react";
import { postOpeningStock } from "@/app/erp/actions";

type Product = { id: string; product_code: string; name: string };
type Journal = { id: string; entry_number: string; entry_date: string; total_debit: number };

export function OpeningStockForm({
  products,
  journals,
}: {
  products: Product[];
  journals: Journal[];
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const journal = journals[0];
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const total = Math.max(0, Number(quantity) || 0) * Math.max(0, Number(unitCost) || 0);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Opening stock</h2>
          <p>Initialize physical stock against an existing posted opening journal. No duplicate GL entry is created.</p>
        </div>
      </div>
      {!journal ? (
        <div className="empty-state">
          <strong>No posted opening journal</strong>
          <span>Post the opening balance journal first, then initialize the physical inventory.</span>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            setMessage({});
            startTransition(async () => setMessage(await postOpeningStock(fd)));
          }}
          className="form-grid"
        >
          <input type="hidden" name="reference_id" value={journal.id} />
          <input type="hidden" name="transaction_date" value={journal.entry_date} />
          <label>
            <span>Product</span>
            <select name="product_id" required disabled={isPending || products.length === 0}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.product_code} · {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Opening journal</span>
            <input value={journal.entry_number + " · " + journal.entry_date} readOnly />
          </label>
          <label>
            <span>Quantity</span>
            <input
              name="quantity"
              type="number"
              min="0.000001"
              step="0.000001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              disabled={isPending}
            />
          </label>
          <label>
            <span>Unit cost</span>
            <input
              name="unit_cost"
              type="number"
              min="0"
              step="0.0001"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              required
              disabled={isPending}
            />
          </label>
          <label>
            <span>Total inventory value</span>
            <input value={total.toFixed(2)} readOnly />
          </label>
          <label>
            <span>Description</span>
            <input name="description" defaultValue="Opening physical stock" disabled={isPending} />
          </label>
          <div>
            <button type="submit" disabled={isPending || products.length === 0}>
              {isPending ? "Posting…" : "Post opening stock"}
            </button>
          </div>
          {message.error ? <p role="alert">{message.error}</p> : null}
          {message.success ? <p role="status">{message.success}</p> : null}
        </form>
      )}
    </section>
  );
}
