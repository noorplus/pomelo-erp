import Link from "next/link";
import { ErpPageShell } from "@/components/erp-page-shell";
import { DataTable, DataTableEmpty } from "@/components/data-table";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";

type Search={report?:string;from?:string;to?:string;account?:string};
const money=(v:number)=>v.toFixed(2);
const reports=[
 ["trial-balance","Trial Balance","All account balances for the selected period."],
 ["general-ledger","General Ledger","Line-level double-entry activity by account."],
 ["profit-loss","Profit & Loss","Revenue, COGS and expenses from posted journals."],
 ["balance-sheet","Balance Sheet","Assets, liabilities and equity as of a date."],
 ["receivables","Accounts Receivable","Sales outstanding and customer allocations."],
 ["payables","Accounts Payable","Purchases/expenses outstanding and supplier allocations."],
 ["inventory","Inventory","Current stock, valuation and movement summary."],
 ["sales","Sales Register","Posted sales and sales returns."],
 ["purchases","Purchase Register","Posted purchases and purchase returns."],
 ["expenses","Expense Register","Posted operating expenses by category."],
 ["cash-bank","Cash & Bank","Ledger activity for current Cash/Bank accounts."],
] as const;

export default async function ReportsPage({searchParams}:{searchParams:Promise<Search>}){
 const p=await searchParams; const report=p.report||"trial-balance";
 const from=p.from||"1900-01-01"; const to=p.to||"2999-12-31";
 const org=await getCurrentOrganization(); const supabase=await createClient();
 const [{data:accounts},{data:tx},{data:journals},{data:contacts}]=await Promise.all([
  supabase.from("accounts").select("id,account_code,account_name,account_type,normal_balance").eq("organization_id",org.id).order("account_code"),
  supabase.from("account_transactions").select("id,journal_entry_id,account_id,line_number,description,debit,credit,contact_id,created_at").eq("organization_id",org.id).limit(20000),
  supabase.from("journal_entries").select("id,entry_number,entry_date,entry_type,status,reference_type,reference_id,description").eq("organization_id",org.id).eq("status","posted").order("entry_date"),
  supabase.from("contacts").select("id,contact_number,name").eq("organization_id",org.id).order("name")
 ]);
 const accountMap=new Map((accounts??[]).map(x=>[x.id,x]));
 const journalMap=new Map((journals??[]).map(x=>[x.id,x]));
 const contactMap=new Map((contacts??[]).map(x=>[x.id,x]));
 const filteredTx=(tx??[]).filter(x=>{const d=journalMap.get(x.journal_entry_id)?.entry_date;return !!d&&d>=from&&d<=to});
 const nav=<div className="report-tabs">{reports.map(([key,label])=><Link key={key} className={report===key?"report-tab active":"report-tab"} href={`/reports?report=${key}&from=${from==="1900-01-01"?"":from}&to=${to==="2999-12-31"?"":to}`}>{label}</Link>)}</div>;
 const filters=<form className="report-filter" method="get"><input type="hidden" name="report" value={report}/><label><span>From</span><input type="date" name="from" defaultValue={p.from}/></label><label><span>To</span><input type="date" name="to" defaultValue={p.to}/></label><button className="secondary-button compact">Apply</button></form>;

 let body:React.ReactNode=null;
 if(report==="trial-balance"||report==="profit-loss"||report==="balance-sheet"){
   const sums=new Map<string,{debit:number;credit:number}>();
   for(const x of filteredTx){const v=sums.get(x.account_id)||{debit:0,credit:0};v.debit+=Number(x.debit);v.credit+=Number(x.credit);sums.set(x.account_id,v);}
   const rows=(accounts??[]).filter(a=>sums.has(a.id)).map(a=>{const v=sums.get(a.id)!;return {...a,debit:v.debit,credit:v.credit,net:v.debit-v.credit}}).sort((a,b)=>a.account_code.localeCompare(b.account_code));
   const selected=report==="profit-loss"?rows.filter(x=>["revenue","expense"].includes(x.account_type)):report==="balance-sheet"?rows.filter(x=>["asset","liability","equity"].includes(x.account_type)):rows;
   const totals=selected.reduce((a,x)=>({debit:a.debit+x.debit,credit:a.credit+x.credit}),{debit:0,credit:0});
   body=<DataTable minWidth={900}><thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Debit</th><th>Credit</th><th>Net</th></tr></thead><tbody>{selected.map(x=><tr key={x.id}><td>{x.account_code}</td><td>{x.account_name}</td><td>{x.account_type}</td><td className="numeric">{money(x.debit)}</td><td className="numeric">{money(x.credit)}</td><td className="numeric">{money(x.net)}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>Total</th><th className="numeric">{money(totals.debit)}</th><th className="numeric">{money(totals.credit)}</th><th className="numeric">{money(totals.debit-totals.credit)}</th></tr></tfoot></DataTable>;
 } else if(report==="general-ledger"){
   const selectedAccount=p.account||"";
   const rows=filteredTx.filter(x=>!selectedAccount||x.account_id===selectedAccount).sort((a,b)=>String(journalMap.get(a.journal_entry_id)?.entry_date).localeCompare(String(journalMap.get(b.journal_entry_id)?.entry_date))||a.line_number-b.line_number);
   let running=0;
   body=<><form className="report-filter"><label><span>Account</span><select name="account" defaultValue={selectedAccount}><option value="">All accounts</option>{(accounts??[]).map(a=><option key={a.id} value={a.id}>{a.account_code} · {a.account_name}</option>)}</select></label><input type="hidden" name="report" value="general-ledger"/><input type="hidden" name="from" value={p.from||""}/><input type="hidden" name="to" value={p.to||""}/><button className="secondary-button compact">Apply</button></form><DataTable minWidth={1100}><thead><tr><th>Date</th><th>Journal</th><th>Account</th><th>Description</th><th>Contact</th><th>Debit</th><th>Credit</th><th>Running</th></tr></thead><tbody>{rows.map(x=>{running+=Number(x.debit)-Number(x.credit);const a=accountMap.get(x.account_id);return <tr key={x.id}><td>{journalMap.get(x.journal_entry_id)?.entry_date}</td><td>{journalMap.get(x.journal_entry_id)?.entry_number}</td><td>{a?.account_code} · {a?.account_name}</td><td>{x.description||journalMap.get(x.journal_entry_id)?.description||"—"}</td><td>{x.contact_id?contactMap.get(x.contact_id)?.name:"—"}</td><td className="numeric">{money(Number(x.debit))}</td><td className="numeric">{money(Number(x.credit))}</td><td className="numeric">{money(running)}</td></tr>})}</tbody></DataTable></>;
 } else if(report==="inventory"){
   const [{data:balances},{data:movements},{data:products}]=await Promise.all([
    supabase.from("inventory_balances").select("product_id,quantity,average_cost,inventory_value,updated_at").eq("organization_id",org.id).order("inventory_value",{ascending:false}),
    supabase.from("inventory_transactions").select("product_id,transaction_date,transaction_type,direction,quantity,total_value").eq("organization_id",org.id).gte("transaction_date",from).lte("transaction_date",to).order("transaction_date",{ascending:false}),
    supabase.from("products").select("id,product_code,name").eq("organization_id",org.id)
   ]);
   const pm=new Map((products??[]).map(x=>[x.id,x]));
   body=<><div className="metric-grid"><div className="metric-card"><span>Stock lines</span><strong>{balances?.length??0}</strong></div><div className="metric-card"><span>Quantity</span><strong>{(balances??[]).reduce((a,x)=>a+Number(x.quantity),0).toFixed(2)}</strong></div><div className="metric-card"><span>Value</span><strong>{money((balances??[]).reduce((a,x)=>a+Number(x.inventory_value),0))}</strong></div><div className="metric-card"><span>Movements</span><strong>{movements?.length??0}</strong></div></div><DataTable minWidth={950}><thead><tr><th>Product</th><th>Qty</th><th>WAC</th><th>Value</th><th>Updated</th></tr></thead><tbody>{(balances??[]).map(x=><tr key={x.product_id}><td>{pm.get(x.product_id)?.product_code} · {pm.get(x.product_id)?.name}</td><td className="numeric">{Number(x.quantity).toFixed(2)}</td><td className="numeric">{Number(x.average_cost).toFixed(4)}</td><td className="numeric">{money(Number(x.inventory_value))}</td><td>{new Date(x.updated_at).toLocaleDateString("en-BD")}</td></tr>)}</tbody></DataTable></>;
 } else if(report==="receivables"||report==="payables"){
   const [{data:pi},{data:si},{data:ex},{data:pa}]=await Promise.all([
    supabase.from("purchase_invoices").select("id,invoice_number,invoice_date,document_type,supplier_id,total_amount,status").eq("organization_id",org.id).eq("status","posted"),
    supabase.from("sales_invoices").select("id,invoice_number,invoice_date,document_type,customer_id,total_amount,status").eq("organization_id",org.id).eq("status","posted"),
    supabase.from("expenses").select("id,expense_number,expense_date,contact_id,amount,status").eq("organization_id",org.id).eq("status","posted"),
    supabase.from("payment_allocations").select("document_type,document_id,allocated_amount").eq("organization_id",org.id)
   ]);
   const allocated=new Map<string,number>();for(const x of pa??[]){allocated.set(x.document_type+":"+x.document_id,(allocated.get(x.document_type+":"+x.document_id)||0)+Number(x.allocated_amount));}
   const rows=report==="receivables"
    ? (si??[]).filter(x=>x.document_type==="sale"||x.document_type==="return").map(x=>({number:x.invoice_number,date:x.invoice_date,type:x.document_type,contact:contactMap.get(x.customer_id)?.name||"—",total:Number(x.total_amount)*(x.document_type==="return"?-1:1),allocated:(allocated.get((x.document_type==="return"?"sale_return":"sale")+":"+x.id)||0)}))
    : [...(pi??[]).map(x=>({number:x.invoice_number,date:x.invoice_date,type:x.document_type,contact:contactMap.get(x.supplier_id)?.name||"—",total:Number(x.total_amount)*(x.document_type==="return"?-1:1),allocated:(allocated.get((x.document_type==="return"?"purchase_return":"purchase")+":"+x.id)||0)})),...(ex??[]).map(x=>({number:x.expense_number,date:x.expense_date,type:"expense",contact:x.contact_id?contactMap.get(x.contact_id)?.name||"—":"—",total:Number(x.amount),allocated:(allocated.get("expense:"+x.id)||0)}))];
   const filtered=rows.filter(x=>x.date>=from&&x.date<=to);
   body=<DataTable minWidth={950}><thead><tr><th>Document</th><th>Date</th><th>Type</th><th>Contact</th><th>Total</th><th>Allocated</th><th>Outstanding</th></tr></thead><tbody>{filtered.map((x,i)=><tr key={x.number+i}><td>{x.number}</td><td>{x.date}</td><td>{x.type}</td><td>{x.contact}</td><td className="numeric">{money(x.total)}</td><td className="numeric">{money(x.allocated)}</td><td className="numeric">{money(x.total-x.allocated)}</td></tr>)}</tbody></DataTable>;
 } else if(report==="sales"||report==="purchases"){
   const table=report==="sales"?"sales_invoices":"purchase_invoices"; const contactField=report==="sales"?"customer_id":"supplier_id";
   const {data}=await supabase.from(table).select(`invoice_number,invoice_date,document_type,${contactField},subtotal,discount_amount,total_amount,status`).eq("organization_id",org.id).eq("status","posted").gte("invoice_date",from).lte("invoice_date",to).order("invoice_date",{ascending:false});
   body=<DataTable minWidth={950}><thead><tr><th>Invoice</th><th>Date</th><th>Type</th><th>Contact</th><th>Subtotal</th><th>Discount</th><th>Total</th></tr></thead><tbody>{(data??[]).map((x:any)=><tr key={x.invoice_number}><td>{x.invoice_number}</td><td>{x.invoice_date}</td><td>{x.document_type}</td><td>{contactMap.get(x[contactField])?.name||"—"}</td><td className="numeric">{money(Number(x.subtotal))}</td><td className="numeric">{money(Number(x.discount_amount))}</td><td className="numeric">{money(Number(x.total_amount))}</td></tr>)}</tbody></DataTable>;
 } else if(report==="expenses"){
   const [{data:ex},{data:cats}]=await Promise.all([
    supabase.from("expenses").select("expense_number,expense_date,expense_category_id,contact_id,amount,description,status").eq("organization_id",org.id).eq("status","posted").gte("expense_date",from).lte("expense_date",to).order("expense_date",{ascending:false}),
    supabase.from("expense_categories").select("id,category_code,name").eq("organization_id",org.id)
   ]);
   const cm=new Map((cats??[]).map(x=>[x.id,x])); body=<DataTable minWidth={900}><thead><tr><th>Expense</th><th>Date</th><th>Category</th><th>Contact</th><th>Description</th><th>Amount</th></tr></thead><tbody>{(ex??[]).map(x=><tr key={x.expense_number}><td>{x.expense_number}</td><td>{x.expense_date}</td><td>{cm.get(x.expense_category_id)?.name||"—"}</td><td>{x.contact_id?contactMap.get(x.contact_id)?.name:"—"}</td><td>{x.description||"—"}</td><td className="numeric">{money(Number(x.amount))}</td></tr>)}</tbody></DataTable>;
 } else if(report==="cash-bank"){
   const selected=(accounts??[]).filter(a=>/cash|bank/i.test(a.account_name));
   const ids=new Set(selected.map(x=>x.id)); const rows=filteredTx.filter(x=>ids.has(x.account_id));
   body=<DataTable minWidth={950}><thead><tr><th>Date</th><th>Journal</th><th>Account</th><th>Description</th><th>Debit</th><th>Credit</th><th>Net</th></tr></thead><tbody>{rows.map(x=>{const a=accountMap.get(x.account_id);return <tr key={x.id}><td>{journalMap.get(x.journal_entry_id)?.entry_date}</td><td>{journalMap.get(x.journal_entry_id)?.entry_number}</td><td>{a?.account_code} · {a?.account_name}</td><td>{x.description||"—"}</td><td className="numeric">{money(Number(x.debit))}</td><td className="numeric">{money(Number(x.credit))}</td><td className="numeric">{money(Number(x.debit)-Number(x.credit))}</td></tr>})}</tbody></DataTable>;
 }
 const title=reports.find(x=>x[0]===report)?.[1]||"Reports";
 return <ErpPageShell><div className="module-page"><div className="page-heading"><div><p className="eyebrow">Reporting</p><h1>{title}</h1><p>All reports are derived from the current database transactions; no reporting tables or schema changes are introduced.</p></div></div>{nav}{filters}<section className="panel"><div className="panel-heading"><div><h2>{title}</h2><p>Period: {p.from||"All time"} → {p.to||"All time"}</p></div></div>{body||<DataTableEmpty title="No report rows" description="No records match the selected filters."/>}</section></div></ErpPageShell>;
}
