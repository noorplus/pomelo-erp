import { ErpPageShell } from "@/components/erp-page-shell";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";

export default async function Home(){
 const org=await getCurrentOrganization(),supabase=await createClient();
 const [{count:products},{count:contacts},{count:stockLines},{count:journals},{data:stock},{data:recent}]=await Promise.all([
  supabase.from("products").select("id",{count:"exact",head:true}).eq("organization_id",org.id),
  supabase.from("contacts").select("id",{count:"exact",head:true}).eq("organization_id",org.id),
  supabase.from("inventory_balances").select("id",{count:"exact",head:true}).eq("organization_id",org.id),
  supabase.from("journal_entries").select("id",{count:"exact",head:true}).eq("organization_id",org.id).eq("status","posted"),
  supabase.from("inventory_balances").select("inventory_value").eq("organization_id",org.id),
  supabase.from("journal_entries").select("id,entry_number,entry_date,entry_type,description").eq("organization_id",org.id).eq("status","posted").order("entry_date",{ascending:false}).limit(8)
 ]);
 const inventoryValue=(stock??[]).reduce((a,x)=>a+Number(x.inventory_value),0);
 return <ErpPageShell><div className="dashboard"><div className="page-heading"><div><p className="eyebrow">Dashboard</p><h1>{org.name}</h1><p>Operational and financial overview from the current ERP database.</p></div></div><section className="metric-grid"><div className="metric-card"><span>Products</span><strong>{products??0}</strong></div><div className="metric-card"><span>Contacts</span><strong>{contacts??0}</strong></div><div className="metric-card"><span>Inventory value</span><strong>{inventoryValue.toFixed(2)}</strong></div><div className="metric-card"><span>Posted journals</span><strong>{journals??0}</strong></div></section><section className="panel"><div className="panel-heading"><div><h2>Recent accounting activity</h2><p>Posted entries from the immutable journal ledger.</p></div></div>{recent?.length?<div className="data-table-scroll"><table className="data-table"><thead><tr><th>Number</th><th>Date</th><th>Type</th><th>Description</th></tr></thead><tbody>{recent.map(x=><tr key={x.id}><td>{x.entry_number}</td><td>{x.entry_date}</td><td>{x.entry_type}</td><td>{x.description??"—"}</td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>No posted activity yet</strong><span>Configure accounts and periods, then create a purchase, sale, expense, payment or manual journal.</span></div>}</section></div></ErpPageShell>;
}