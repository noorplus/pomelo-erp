import { ErpPageShell } from "@/components/erp-page-shell";
import { ConfigurationManager } from "@/components/configuration-manager";
import { DataTable, DataTableEmpty } from "@/components/data-table";
import { JournalForm } from "@/components/journal-form";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { postManualJournal, reverseJournal } from "@/app/erp/actions";

export default async function AccountingPage(){
 const org=await getCurrentOrganization(),supabase=await createClient();
 const [{data:accounts},{data:periods},{data:journals,error}]=await Promise.all([
  supabase.from("accounts").select("id,account_code,account_name,account_type,is_postable,is_active").eq("organization_id",org.id).eq("is_active",true).order("account_code"),
  supabase.from("accounting_periods").select("id,name,start_date,end_date,status").eq("organization_id",org.id).order("start_date",{ascending:false}),
  supabase.from("journal_entries").select("id,entry_number,entry_date,entry_type,status,description,reversal_of_id").eq("organization_id",org.id).order("entry_date",{ascending:false}).limit(200)
 ]);
 const postable=(accounts??[]).filter(x=>x.is_postable);
 const template=JSON.stringify([{account_id:postable[0]?.id??"",debit:0,credit:0,description:""},{account_id:postable[1]?.id??"",debit:0,credit:0,description:""}]);
 return <ErpPageShell><div className="module-page"><div className="page-heading"><div><p className="eyebrow">Finance</p><h1>Accounting</h1><p>Double-entry ledger and controlled posting/reversal workflows.</p></div></div><section className="metric-grid"><div className="metric-card"><span>Accounts</span><strong>{accounts?.length??0}</strong></div><div className="metric-card"><span>Open periods</span><strong>{(periods??[]).filter(x=>x.status==="open").length}</strong></div><div className="metric-card"><span>Posted journals</span><strong>{(journals??[]).filter(x=>x.status==="posted").length}</strong></div><div className="metric-card"><span>Recent journals</span><strong>{journals?.length??0}</strong></div></section><section className="panel"><div className="panel-heading"><div><h2>Manual journal</h2><p>Use manual journals only for non-operational accounting adjustments.</p></div></div><JournalForm action={postManualJournal} accounts={postable}/></section><section className="panel"><div className="panel-heading"><div><h2>Journal register</h2><p>{journals?.length??0} recent entries</p></div></div>{error?<DataTableEmpty title="Unable to load journals" description={error.message}/>:journals?.length?<DataTable minWidth={900}><thead><tr><th>Number</th><th>Date</th><th>Type</th><th>Status</th><th>Description</th><th>Action</th></tr></thead><tbody>{journals.map(x=><tr key={x.id}><td>{x.entry_number}</td><td>{x.entry_date}</td><td>{x.entry_type}</td><td>{x.status}</td><td>{x.description??"—"}</td><td>{x.entry_type==="manual"&&x.status==="posted"?<ActionForm action={reverseJournal} submitLabel="Reverse"><input type="hidden" name="id" value={x.id}/><input type="hidden" name="reversal_date" value={new Date().toISOString().slice(0,10)}/></ActionForm>:"—"}</td></tr>)}</tbody></DataTable>:<DataTableEmpty title="No journal entries" description="Posted operational documents and manual journals will appear here."/>}</section></div></ErpPageShell>;
}