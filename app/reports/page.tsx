import { ErpPageShell } from "@/components/erp-page-shell";
import { DataTable, DataTableEmpty } from "@/components/data-table";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";

export default async function ReportsPage(){
 const org=await getCurrentOrganization(),supabase=await createClient();
 const {data:rows,error}=await supabase.from("account_transactions").select("account_id,debit,credit").eq("organization_id",org.id).limit(10000);
 const ids=[...new Set((rows??[]).map(x=>x.account_id))];
 const {data:accounts}=ids.length?await supabase.from("accounts").select("id,account_code,account_name,account_type").eq("organization_id",org.id).in("id",ids):{data:[]};
 const map=new Map<string,{code:string;name:string;type:string;debit:number;credit:number}>();
 for(const x of rows??[]){const a=accounts?.find(y=>y.id===x.account_id);if(!a)continue;const v=map.get(x.account_id)??{code:a.account_code,name:a.account_name,type:a.account_type,debit:0,credit:0};v.debit+=Number(x.debit);v.credit+=Number(x.credit);map.set(x.account_id,v);}
 const trial=[...map.values()].sort((a,b)=>a.code.localeCompare(b.code));
 return <ErpPageShell><div className="module-page"><div className="page-heading"><div><p className="eyebrow">Overview</p><h1>Reports</h1><p>Ledger-derived trial balance from the immutable account transaction table.</p></div></div><section className="panel"><div className="panel-heading"><div><h2>Trial balance</h2><p>{trial.length} accounts with activity</p></div></div>{error?<DataTableEmpty title="Unable to load trial balance" description={error.message}/>:trial.length?<DataTable minWidth={900}><thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Debit</th><th>Credit</th><th>Net</th></tr></thead><tbody>{trial.map(x=><tr key={x.code}><td>{x.code}</td><td>{x.name}</td><td>{x.type}</td><td className="numeric">{x.debit.toFixed(2)}</td><td className="numeric">{x.credit.toFixed(2)}</td><td className="numeric">{(x.debit-x.credit).toFixed(2)}</td></tr>)}</tbody></DataTable>:<DataTableEmpty title="No ledger activity" description="Post an operational document or manual journal to populate the trial balance."/>}</section></div></ErpPageShell>;
}