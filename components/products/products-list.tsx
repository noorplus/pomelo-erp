"use client";
import { useMemo,useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DataTable,PageHeader,PageSection,SearchInput,StatusBadge } from "@/components/ui";
import type { Tables } from "@/lib/supabase/database";
type Product=Tables<"products">;
export function ProductsList({rows}:{rows:Product[]}){
 const [query,setQuery]=useState("");
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return rows;return rows.filter(p=>[p.product_code??"",p.name].some(v=>v.toLowerCase().includes(q)));},[rows,query]);
 return <div className="page"><PageHeader eyebrow="Inventory master data" title="Products" description="Products define the units and accounting accounts used by sales, purchasing and inventory." actions={<Link className="button primary" href="/products/new"><Plus size={16}/> New product</Link>}/><PageSection title="Products" description={`${filtered.length} of ${rows.length} products`} actions={<SearchInput value={query} onChange={setQuery} placeholder="Search code or product name"/>}><DataTable rows={filtered} columns={[{key:"code",header:"Code",render:p=>p.product_code??"—"},{key:"name",header:"Product",render:p=><Link className="table-link" href={`/products/${p.id}`}>{p.name}</Link>},{key:"unit",header:"Unit",render:p=>p.unit_id.slice(0,8)},{key:"status",header:"Status",render:p=><StatusBadge tone={p.is_active?"success":"neutral"}>{p.is_active?"Active":"Inactive"}</StatusBadge>},{key:"action",header:"Action",render:p=><Link className="button" href={`/products/${p.id}`}>View</Link>}]} empty="No products found."/></PageSection></div>;
}
