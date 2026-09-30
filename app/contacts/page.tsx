import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { ContactForm } from "./contact-form";
import { ContactStatusForm } from "./status-form";
type SearchParams = Promise<{ q?: string; edit?: string }>;
export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
 const params=await searchParams; const q=(params.q??"").replace(/[^a-zA-Z0-9 _./@+()-]/g,"").trim().slice(0,80); const editId=params.edit??"";
 const supabase=await createClient(); const organization=await getCurrentOrganization();
 let contactQuery=supabase.from("contacts").select("id,contact_number,name,phone,email,address,is_active,created_by,created_at").eq("organization_id",organization.id).order("name");
 if(q) contactQuery=contactQuery.or(`contact_number.ilike.%${q}%,name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
 const [{data:contacts,error:a},{data:sales,error:b},{data:purchases,error:c},{data:payments,error:d},{data:expenses,error:e},{data:transactions,error:f}]=await Promise.all([
  contactQuery,supabase.from("sales_invoices").select("customer_id").eq("organization_id",organization.id),supabase.from("purchase_invoices").select("supplier_id").eq("organization_id",organization.id),supabase.from("payments").select("contact_id").eq("organization_id",organization.id),supabase.from("expenses").select("contact_id").eq("organization_id",organization.id),supabase.from("account_transactions").select("contact_id").eq("organization_id",organization.id)
 ]);
 if(a||b||c||d||e||f) throw new Error("Unable to load contacts and usage data.");
 const usage=new Map<string,{sales:number;purchases:number;payments:number;expenses:number;transactions:number}>();
 const ensure=(id:string)=>{const x=usage.get(id)??{sales:0,purchases:0,payments:0,expenses:0,transactions:0};usage.set(id,x);return x};
 for(const x of sales??[]) if(x.customer_id) ensure(x.customer_id).sales++;
 for(const x of purchases??[]) if(x.supplier_id) ensure(x.supplier_id).purchases++;
 for(const x of payments??[]) if(x.contact_id) ensure(x.contact_id).payments++;
 for(const x of expenses??[]) if(x.contact_id) ensure(x.contact_id).expenses++;
 for(const x of transactions??[]) if(x.contact_id) ensure(x.contact_id).transactions++;
 const editContact=editId?(contacts??[]).find(x=>x.id===editId)??null:null;
 const active=(contacts??[]).filter(x=>x.is_active).length, inactive=(contacts??[]).length-active;
 const customers=(contacts??[]).filter(x=>(usage.get(x.id)?.sales??0)>0).length, suppliers=(contacts??[]).filter(x=>(usage.get(x.id)?.purchases??0)>0).length;
 return <div className="contacts-page">
  <section className="page-heading"><div><p className="eyebrow">Master data</p><h1>Contacts</h1><p>Unified organization contacts used as customers, suppliers and transaction parties across the ERP.</p></div><Link href="/contacts" className="primary-button compact">New contact</Link></section>
  <section className="metric-grid"><article className="metric-card"><span>Total contacts</span><strong>{contacts?.length??0}</strong><small>Organization scoped</small></article><article className="metric-card"><span>Active</span><strong>{active}</strong><small>Available for transactions</small></article><article className="metric-card"><span>Customers used</span><strong>{customers}</strong><small>Referenced by sales invoices</small></article><article className="metric-card"><span>Suppliers used</span><strong>{suppliers}</strong><small>Referenced by purchase invoices</small></article></section>
  <section className="workspace-grid"><div className="panel"><div className="panel-heading"><div><h2>{editContact?"Edit contact":"Create contact"}</h2><p>Contact master fields only. Customer/supplier behavior comes from transaction references.</p></div></div><ContactForm contact={editContact}/></div>
  <div className="panel"><div className="panel-heading"><div><h2>Contact list</h2><p>{contacts?.length??0} contact{contacts?.length===1?"":"s"}</p></div><form method="get" className="search-form"><input name="q" defaultValue={q} placeholder="Search number, name, phone or email" aria-label="Search contacts"/><button className="secondary-button compact" type="submit">Search</button></form></div>
  {contacts&&contacts.length>0?<div className="data-table-wrap"><table className="data-table"><thead><tr><th>Contact</th><th>Details</th><th>Business usage</th><th>Status</th><th/></tr></thead><tbody>{contacts.map(contact=>{const u=usage.get(contact.id)??{sales:0,purchases:0,payments:0,expenses:0,transactions:0};const total=u.sales+u.purchases+u.payments+u.expenses+u.transactions;return <tr key={contact.id}><td><strong>{contact.contact_number}</strong><span>{contact.name}</span></td><td><span>{contact.phone||"No phone"}</span><span>{contact.email||"No email"}</span></td><td><span>{u.sales} sale{u.sales===1?"":"s"} · {u.purchases} purchase{u.purchases===1?"":"s"}</span><span>{u.payments} payment{u.payments===1?"":"s"} · {u.expenses} expense{u.expenses===1?"":"s"}</span><span>{u.transactions} accounting transaction{u.transactions===1?"":"s"}</span></td><td><span className={contact.is_active?"status-pill active":"status-pill"}>{contact.is_active?"Active":"Inactive"}</span></td><td className="row-actions"><Link href={`/contacts?edit=${contact.id}`} className="text-button">Edit</Link><ContactStatusForm id={contact.id} active={contact.is_active} usage={total}/></td></tr>})}</tbody></table></div>:<div className="empty-state"><strong>{q?"No matching contacts":"No contacts yet"}</strong><span>{q?"Try another contact number, name, phone or email.":"Create your first contact using the form."}</span></div>}</div></section>
  <section className="settings-note"><strong>Contact architecture</strong><span>The database intentionally keeps contacts unified. Sales invoices reference contacts as customers, purchase invoices as suppliers, while payments, expenses and accounting transactions can also reference them. There is no separate customer/supplier type field.</span></section>
 </div>;
}