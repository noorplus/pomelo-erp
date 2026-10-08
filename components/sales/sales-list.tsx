/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FilePlus2, RotateCcw } from "lucide-react";
import { DataTable, PageHeader, PageSection, SearchInput, StatusBadge } from "@/components/ui";

const money=(n:number)=>new Intl.NumberFormat("en-BD",{style:"currency",currency:"BDT",maximumFractionDigits:2}).format(n);

export function SalesList({ rows }: { rows: any[] }) {
  const [query,setQuery]=useState("");
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return !q?rows:rows.filter(x=>[x.invoice_id??"Draft",x.customer?.name??"",x.customer?.contact_number??"",x.status].some((v)=>String(v).toLowerCase().includes(q)))},[rows,query]);
  return <div className="page"><PageHeader eyebrow="Sales" title="Invoices" description="Sales documents and their posting status." actions={<><Link className="button" href="/sales/returns"><RotateCcw size={16}/> Returns</Link><Link className="button primary" href="/sales/invoices/new"><FilePlus2 size={16}/> New sale</Link></>}/><PageSection title="Invoices" description={filtered.length+" of "+rows.length+" documents"} actions={<SearchInput value={query} onChange={setQuery} placeholder="Search invoice, customer or status" />}><DataTable rows={filtered} columns={[
{key:"invoice",header:"Invoice",render:(x)=><Link href={"/sales/invoices/"+x.id}>{x.invoice_id??"Draft"}</Link>},
{key:"date",header:"Date",render:(x)=>x.invoice_date},
{key:"customer",header:"Customer",render:(x)=>x.customer?.id?<Link href={"/contacts/"+x.customer.id}>{x.customer.name}</Link>:"—"},
{key:"total",header:"Total",render:(x)=>money(Number(x.total_amount))},
{key:"status",header:"Status",render:(x)=><StatusBadge tone={x.status==="CONFIRMED"?"success":x.status==="CANCELLED"?"danger":"neutral"}>{x.status}</StatusBadge>}
]} empty="No sales invoices found." /></PageSection></div>;
}
