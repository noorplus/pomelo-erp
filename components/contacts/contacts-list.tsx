"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DataTable, PageHeader, PageSection, SearchInput, StatusBadge } from "@/components/ui";
import type { Tables } from "@/lib/supabase/database";
type Contact=Tables<"contacts">;
export function ContactsList({rows}:{rows:Contact[]}){
 const [query,setQuery]=useState("");
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return rows;return rows.filter(c=>[c.contact_number??"",c.name,c.phone??"",c.email??"",c.address??""].some(v=>v.toLowerCase().includes(q)));},[rows,query]);
 return <div className="page"><PageHeader eyebrow="Master data" title="Contacts" description="Customers, suppliers and other business contacts used throughout the ERP." actions={<Link className="button primary" href="/contacts/new"><Plus size={16}/> New contact</Link>}/><PageSection title="Contacts" description={`${filtered.length} of ${rows.length} contacts`} actions={<SearchInput value={query} onChange={setQuery} placeholder="Search number, name, phone or email"/>}><DataTable rows={filtered} columns={[
 {key:"number",header:"Number",render:c=>c.contact_number??"—"},{key:"name",header:"Name",render:c=><Link className="table-link" href={`/contacts/${c.id}`}>{c.name}</Link>},{key:"phone",header:"Phone",render:c=>c.phone??"—"},{key:"email",header:"Email",render:c=>c.email??"—"},{key:"status",header:"Status",render:c=><StatusBadge tone={c.is_active?"success":"neutral"}>{c.is_active?"Active":"Inactive"}</StatusBadge>},{key:"action",header:"Action",render:c=><Link className="button" href={`/contacts/${c.id}`}>View</Link>}
 ]} empty="No contacts found."/></PageSection></div>;
}
