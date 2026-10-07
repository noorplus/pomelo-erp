"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { DataTable, PageHeader, SearchInput, StatusBadge } from "@/components/ui";
import type { Tables } from "@/lib/supabase/database";

type Product = Tables<"products">;

export function Products({ rows }: { rows: Product[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) => [p.product_code ?? "", p.name].some((v) => v.toLowerCase().includes(q)));
  }, [rows, query]);

  return <div className="page">
    <PageHeader eyebrow="Products" title="Products" description="Manage products and their accounting configuration." actions={<Link className="button primary" href="/products/new"><Plus size={16} /> New product</Link>} />
    <div className="content-card">
      <div className="ui-table-toolbar"><div className="ui-table-toolbar-main"><SearchInput value={query} onChange={setQuery} placeholder="Search by code or name" /></div></div>
      <DataTable rows={filtered} columns={[
        { key: "code", header: "Code", render: (p) => <code>{p.product_code ?? "—"}</code> },
        { key: "name", header: "Name", render: (p) => p.name },
        { key: "unit", header: "Unit", render: () => "Configured" },
        { key: "status", header: "Status", render: (p) => <StatusBadge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "Active" : "Inactive"}</StatusBadge> },
        { key: "action", header: "Action", render: (p) => <Link className="button" href={p.id ? "/products/new?edit=" + p.id : "/products/new"}><Pencil size={15} /> Edit</Link> },
      ]} empty="No products found." />
    </div>
  </div>;
}
