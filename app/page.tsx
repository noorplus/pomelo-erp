import Link from "next/link";
import { ErpPageShell } from "@/components/erp-page-shell";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";

export default async function Home(){
 const org=await getCurrentOrganization(),supabase=await createClient();
 const [
  {count:products},{count:contacts},{count:stockLines},{count:journals},
  {count:accounts},{count:units},{count:periods},{count:openPeriods},
  {count:expenseCategories},{count:sequences},
  {data:stock},{data:recent}
 ]=await Promise.all([
  supabase.from("products").select("id",{count:"exact",head:true}).eq("organization_id",org.id),
  supabase.from("contacts").select("id",{count:"exact",head:true}).eq("organization_id",org.id),
  supabase.from("inventory_balances").select("id",{count:"exact",head:true}).eq("organization_id",org.id),
  supabase.from("journal_entries").select("id",{count:"exact",head:true}).eq("organization_id",org.id).eq("status","posted"),
  supabase.from("accounts").select("id",{count:"exact",head:true}).eq("organization_id",org.id),
  supabase.from("units_of_measure").select("id",{count:"exact",head:true}).eq("organization_id",org.id).eq("is_active",true),
  supabase.from("accounting_periods").select("id",{count:"exact",head:true}).eq("organization_id",org.id),
  supabase.from("accounting_periods").select("id",{count:"exact",head:true}).eq("organization_id",org.id).eq("status","open"),
  supabase.from("expense_categories").select("id",{count:"exact",head:true}).eq("organization_id",org.id).eq("is_active",true),
  supabase.from("number_sequences").select("id",{count:"exact",head:true}).eq("organization_id",org.id).eq("is_active",true),
  supabase.from("inventory_balances").select("inventory_value").eq("organization_id",org.id),
  supabase.from("journal_entries").select("id,entry_number,entry_date,entry_type,description").eq("organization_id",org.id).eq("status","posted").order("entry_date",{ascending:false}).limit(8)
 ]);
 const inventoryValue=(stock??[]).reduce((a,x)=>a+Number(x.inventory_value),0);
 const setup=[
  {label:"Chart of Accounts",count:accounts??0,ready:(accounts??0)>0,href:"/accounting/configuration/accounts"},
  {label:"Units of Measure",count:units??0,ready:(units??0)>0,href:"/inventory/configuration/units"},
  {label:"Open Accounting Period",count:openPeriods??0,ready:(openPeriods??0)>0,href:"/accounting/configuration/periods"},
  {label:"Expense Categories",count:expenseCategories??0,ready:(expenseCategories??0)>0,href:"/expenses/configuration/categories"},
  {label:"Active Number Sequences",count:sequences??0,ready:(sequences??0)>0,href:"/settings/number-sequences"},
 ];
 return <ErpPageShell><div className="dashboard">
  <div className="page-heading"><div><p className="eyebrow">Dashboard</p><h1>{org.name}</h1><p>Operational and financial overview from the current ERP database.</p></div></div>
  <section className="metric-grid">
   <div className="metric-card"><span>Products</span><strong>{products??0}</strong></div>
   <div className="metric-card"><span>Contacts</span><strong>{contacts??0}</strong></div>
   <div className="metric-card"><span>Inventory value</span><strong>{inventoryValue.toFixed(2)}</strong></div>
   <div className="metric-card"><span>Posted journals</span><strong>{journals??0}</strong></div>
  </section>
  <section className="panel">
   <div className="panel-heading"><div><h2>ERP setup readiness</h2><p>Configuration status derived only from the frozen ERP tables.</p></div></div>
   <div className="data-table-scroll"><table className="data-table"><thead><tr><th>Configuration</th><th>Status</th><th>Records</th><th>Action</th></tr></thead><tbody>
    {setup.map(item=><tr key={item.label}><td>{item.label}</td><td><span className={item.ready?"status-pill active":"status-pill"}>{item.ready?"Ready":"Needs setup"}</span></td><td className="numeric">{item.count}</td><td><Link className="text-button" href={item.href}>{item.ready?"Review":"Configure"}</Link></td></tr>)}
   </tbody></table></div>
  </section>
  <section className="panel">
   <div className="panel-heading"><div><h2>Recent accounting activity</h2><p>Posted entries from the immutable journal ledger.</p></div></div>
   {recent?.length?<div className="data-table-scroll"><table className="data-table"><thead><tr><th>Number</th><th>Date</th><th>Type</th><th>Description</th></tr></thead><tbody>{recent.map(x=><tr key={x.id}><td>{x.entry_number}</td><td>{x.entry_date}</td><td>{x.entry_type}</td><td>{x.description??"—"}</td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>No posted activity yet</strong><span>Configure accounts and periods, then create a purchase, sale, expense, payment or manual journal.</span></div>}
  </section>
 </div></ErpPageShell>;
}
