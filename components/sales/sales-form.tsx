"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createSale } from "@/lib/sales/actions";
import { FormActions, FormField, PageHeader, PageSection, Select } from "@/components/ui";
import { getErrorMessage } from "@/lib/app/errors";

type Product={id:string;product_code:string|null;name:string};
type Option={id:string;name:string;contact_number:string|null};
type Account={id:string;account_code:string;account_name:string};
type Line={product_id:string;quantity:number;unit_price:number};

export function SalesForm({org,userId,customers,accounts,products}:{org:string;userId:string;customers:Option[];accounts:Account[];products:Product[]}) {
 const router=useRouter(); const today=new Date().toISOString().slice(0,10);
 const [customerId,setCustomerId]=useState(""); const [accountId,setAccountId]=useState(""); const [date,setDate]=useState(today); const [discount,setDiscount]=useState(0);
 const [lines,setLines]=useState<Line[]>([{product_id:"",quantity:1,unit_price:0}]); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 const subtotal=useMemo(()=>lines.reduce((n,l)=>n+(Number(l.quantity)||0)*(Number(l.unit_price)||0),0),[lines]); const total=Math.max(0,subtotal-Math.max(0,Number(discount)||0));
 function update(i:number,k:keyof Line,v:string){setLines(a=>a.map((l,idx)=>idx===i?{...l,[k]:k==="product_id"?v:Number(v)}:l))}
 async function submit(e:React.FormEvent){e.preventDefault();setError("");if(!customerId||!accountId) return setError("Customer and receivable account are required.");const valid=lines.filter(l=>l.product_id&&l.quantity>0&&l.unit_price>=0);if(valid.length!==lines.length)return setError("Complete every product line.");setBusy(true);try{const sale=await createSale(createClient(),org,userId,{customer_id:customerId,invoice_date:date,receivable_account_id:accountId,discount_amount:Number(discount)||0,items:valid});router.push("/sales/invoices/"+sale.id);router.refresh()}catch(cause){setError(getErrorMessage(cause));setBusy(false)}}
 return <div className="page"><PageHeader eyebrow="Sales" title="New sale" description="Create a draft invoice. Confirmation will allocate its invoice number and post inventory and accounting." actions={<Link className="button" href="/sales/invoices">Invoices</Link>}/><PageSection title="Invoice details"><form className="ui-form-grid" onSubmit={submit}>
 <FormField label="Customer" required><Select value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.contact_number?c.contact_number+" — ":""}{c.name}</option>)}</Select></FormField>
 <FormField label="Invoice date" required><input className="ui-input" type="date" value={date} onChange={e=>setDate(e.target.value)} required/></FormField>
 <FormField label="Receivable account" required><Select value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">Select asset account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}</Select></FormField>
 <div className="ui-table-wrap"><table className="ui-table"><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Total</th><th></th></tr></thead><tbody>{lines.map((l,i)=><tr key={i}><td><Select value={l.product_id} onChange={e=>update(i,"product_id",e.target.value)}><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.product_code? p.product_code+" — ":""}{p.name}</option>)}</Select></td><td><input className="ui-input" type="number" min="0.0001" step="0.0001" value={l.quantity} onChange={e=>update(i,"quantity",e.target.value)}/></td><td><input className="ui-input" type="number" min="0" step="0.0001" value={l.unit_price} onChange={e=>update(i,"unit_price",e.target.value)}/></td><td>{(l.quantity*l.unit_price).toFixed(2)}</td><td><button className="button" type="button" onClick={()=>setLines(a=>a.filter((_,idx)=>idx!==i))} disabled={lines.length===1}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>
 <button className="button" type="button" onClick={()=>setLines(a=>[...a,{product_id:"",quantity:1,unit_price:0}])}><Plus size={16}/> Add line</button>
 <FormField label="Discount"><input className="ui-input" type="number" min="0" step="0.0001" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></FormField>
 <div className="content-card"><strong>Subtotal: {subtotal.toFixed(2)}</strong><br/>Discount: {Number(discount||0).toFixed(2)}<br/><strong>Total: {total.toFixed(2)}</strong></div>
 {error?<p className="ui-field-error" role="alert">{error}</p>:null}<FormActions><Link className="button" href="/sales/invoices">Cancel</Link><button className="button primary" disabled={busy}>{busy?"Saving…":"Create draft"}</button></FormActions>
 </form></PageSection></div>;
}
