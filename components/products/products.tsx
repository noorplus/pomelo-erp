"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { DataTable, PageHeader, PageSection, SearchInput, StatusBadge } from "@/components/ui";
import type { Tables } from "@/lib/supabase/database";

type Product = Tables<"products">;

export function Products({ rows }: { rows: Product[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((product) =>
      [product.product_code ?? "", product.name].some((value) => value.toLowerCase().includes(q)),
    );
  }, [rows, query]);

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
            placeholder="Search by code or name"
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
    </div>
  );
}
