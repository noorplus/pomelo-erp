"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createUnit, updateUnit } from "@/lib/products/actions";
import { DataTable, FormActions, FormField, PageHeader, PageSection, SearchInput, StatusBadge } from "@/components/ui";
import { getErrorMessage } from "@/lib/app/errors";
import type { Tables } from "@/lib/supabase/database";

type Product = Tables<"products">;
type Unit = { id: string; name: string; is_active: boolean };

export function Products({ org, rows, units }: { org: string; rows: Product[]; units: Unit[] }) {
  const router = useRouter();
  const [unitName, setUnitName] = useState("");
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitError, setUnitError] = useState("");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((product) =>
      [product.product_code ?? "", product.name, units.find((unit) => unit.id === product.unit_id)?.name ?? ""].some((value) => value.toLowerCase().includes(q)),
    );
  }, [rows, query, units]);

  async function saveUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnitError("");
    if (!unitName.trim()) { setUnitError("Unit name is required."); return; }
    setSavingUnit(true);
    try {
      if (editingUnitId) await updateUnit(createClient(), org, editingUnitId, { name: unitName.trim() });
      else await createUnit(createClient(), org, unitName.trim());
      setUnitName(""); setEditingUnitId(null); router.refresh();
    } catch (cause) { setUnitError(getErrorMessage(cause)); }
    finally { setSavingUnit(false); }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Products"
        title="Products"
        description="Manage products and their accounting configuration."
        actions={
          <Link className="button primary" href="/products/new">
            <Plus size={16} aria-hidden="true" /> New product
          </Link>
        }
      />
      <PageSection
        title="Product catalogue"
        description={`${filtered.length} of ${rows.length} product${rows.length === 1 ? "" : "s"}`}
        actions={
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by code, name or unit"
          />
        }
      >
        <DataTable
          rows={filtered}
          columns={[
            {
              key: "code",
              header: "Code",
              render: (product) => (
                <Link href={`/products/${product.id}`}>
                  <code>{product.product_code ?? "—"}</code>
                </Link>
              ),
            },
            {
              key: "name",
              header: "Product name",
              render: (product) => <Link href={`/products/${product.id}`}>{product.name}</Link>,
            },
            {
              key: "unit",
              header: "Unit",
              render: (product) => units.find((unit) => unit.id === product.unit_id)?.name ?? "—",
            },
            {
              key: "status",
              header: "Status",
              render: (product) => (
                <StatusBadge tone={product.is_active ? "success" : "neutral"}>
                  {product.is_active ? "Active" : "Inactive"}
                </StatusBadge>
              ),
            },
          ]}
          empty="No products match your search."
        />
      </PageSection>
      <PageSection title="Units of measure" description="Maintain the units used by products and inventory.">
        <form className="ui-member-form" onSubmit={saveUnit}>
          <FormField label="Unit name" htmlFor="product-unit-name" required>
            <input id="product-unit-name" className="ui-input" value={unitName} onChange={(event) => setUnitName(event.target.value)} required />
          </FormField>
          <FormActions>
            <button className="button primary" type="submit" disabled={savingUnit}>{savingUnit ? "Saving…" : editingUnitId ? "Save unit" : "Add unit"}</button>
            {editingUnitId ? <button className="button" type="button" onClick={() => { setEditingUnitId(null); setUnitName(""); setUnitError(""); }} disabled={savingUnit}>Cancel</button> : null}
          </FormActions>
        </form>
        {unitError ? <p className="ui-field-error" role="alert">{unitError}</p> : null}
        <DataTable rows={units} columns={[
          { key: "name", header: "Unit name", render: (unit) => unit.name },
          { key: "status", header: "Status", render: (unit) => <StatusBadge tone={unit.is_active ? "success" : "neutral"}>{unit.is_active ? "Active" : "Inactive"}</StatusBadge> },
          { key: "action", header: "Action", render: (unit) => <button className="button" type="button" onClick={() => { setEditingUnitId(unit.id); setUnitName(unit.name); setUnitError(""); }}>Edit</button> },
        ]} empty="No units of measure found." />
      </PageSection>
    </div>
  );
}
