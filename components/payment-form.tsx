"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/erp/types";

type Target={id:string;label:string;document_type:string;contact_id:string|null;amount:number};

export function PaymentForm({action,contacts,accounts,targets}:{action:(fd:FormData)=>Promise<ActionState>;contacts:{id:string;name:string;contact_number:string}[];accounts:{id:string;account_code:string;account_name:string;account_type:string}[];targets:Target[]}) {
  const [type,setType]=useState("receipt");
  const [alloc,setAlloc]=useState<{document_type:string;document_id:string;allocated_amount:string}[]>([]);
  const [state,setState]=useState<ActionState>({});
  const set=(i:number,k:string,v:string)=>setAlloc(a=>a.map((x,n)=>n===i?{...x,[k]:v}:x));
  const add=()=>setAlloc(a=>[...a,{document_type:type==="receipt"?"sale":type==="payment"?"purchase":type==="refund_in"?"purchase_return":"sale_return",document_id:"",allocated_amount:""}]);
  const remove=(i:number)=>setAlloc(a=>a.filter((_,n)=>n!==i));
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const fd=new FormData(e.currentTarget);fd.set("allocations_json",JSON.stringify(alloc.filter(x=>x.document_id&&Number(x.allocated_amount)>0).map(x=>({...x,allocated_amount:Number(x.allocated_amount)}))));setState(await action(fd));}
  const allowed=targets.filter(t=>t.document_type===(type==="receipt"?"sale":type==="payment"?"purchase":type==="refund_in"?"purchase_return":"sale_return"));
  return <form className="erp-form" onSubmit={submit}>
    <div className="form-grid">
      <label><span>Payment type</span><select name="payment_type" value={type} onChange={e=>{setType(e.target.value);setAlloc([])}}><option value="receipt">Receipt</option><option value="payment">Payment</option><option value="refund_in">Refund in</option><option value="refund_out">Refund out</option></select></label>
      <label><span>Contact</span><select name="contact_id" required><option value="">Select...</option>{contacts.map(x=><option key={x.id} value={x.id}>{x.contact_number} · {x.name}</option>)}</select></label>
      <label><span>Cash / bank account</span><select name="account_id" required><option value="">Select...</option>{accounts.filter(x=>x.account_type==="asset").map(x=><option key={x.id} value={x.id}>{x.account_code} · {x.account_name}</option>)}</select></label>
      <label><span>Settlement account</span><select name="settlement_account_id" required><option value="">Select...</option>{accounts.map(x=><option key={x.id} value={x.id}>{x.account_code} · {x.account_name}</option>)}</select></label>
      <label><span>Date</span><input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required /></label>
      <label><span>Amount</span><input name="amount" type="number" min="0.01" step="0.00000001" required /></label>
      <label><span>Description</span><input name="description" /></label>
    </div>
    <div className="invoice-lines">
      <div className="panel-heading"><div><h3>Allocations</h3><p>Optional; the database enforces document compatibility and allocation ceilings.</p></div><button type="button" className="secondary-button compact" onClick={add}>Add allocation</button></div>
      {alloc.map((x,i)=><div className="invoice-line" key={i}>
        <label><span>Document</span><select value={x.document_id} onChange={e=>set(i,"document_id",e.target.value)}><option value="">Select...</option>{allowed.map(t=><option key={t.id} value={t.id}>{t.label} · {t.amount.toFixed(2)}</option>)}</select></label>
        <label><span>Amount</span><input type="number" min="0.01" step="0.00000001" value={x.allocated_amount} onChange={e=>set(i,"allocated_amount",e.target.value)} /></label>
        <button type="button" className="text-button danger-text" onClick={()=>remove(i)}>Remove</button>
      </div>)}
    </div>
    {state.error&&<p className="form-message error">{state.error}</p>}{state.success&&<p className="form-message success">{state.success}</p>}
    <button className="primary-button">Create & post payment</button>
  </form>;
}
