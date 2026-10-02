"use client";

import { useState } from "react";
import type { ActionState } from "@/app/erp/actions";

type Account={id:string;account_code:string;account_name:string};

export function JournalForm({action,accounts}:{action:(fd:FormData)=>Promise<ActionState>;accounts:Account[]}){
 const [rows,setRows]=useState([{account_id:"",debit:"",credit:"",description:""}]);
 const [state,setState]=useState<ActionState>({});
 const set=(i:number,k:string,v:string)=>setRows(r=>r.map((x,n)=>n===i?{...x,[k]:v}:x));
 const add=()=>setRows(r=>[...r,{account_id:"",debit:"",credit:"",description:""}]);
 const remove=(i:number)=>setRows(r=>r.length<=2?r:r.filter((_,n)=>n!==i));
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const fd=new FormData(e.currentTarget);fd.set("lines_json",JSON.stringify(rows.map(x=>({account_id:x.account_id,debit:Number(x.debit||0),credit:Number(x.credit||0),description:x.description||undefined}))));setState(await action(fd));}
 const debit=rows.reduce((a,x)=>a+Number(x.debit||0),0),credit=rows.reduce((a,x)=>a+Number(x.credit||0),0);
 return <form className="erp-form" onSubmit={submit}><div className="form-grid"><label><span>Entry date</span><input name="entry_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label><label><span>Description</span><input name="description" required/></label></div><div className="invoice-lines"><div className="panel-heading"><div><h3>Journal lines</h3><p>Each line must be debit or credit; totals must balance.</p></div><button type="button" className="secondary-button compact" onClick={add}>Add line</button></div>{rows.map((x,i)=><div className="invoice-line" key={i}><label><span>Account</span><select value={x.account_id} onChange={e=>set(i,"account_id",e.target.value)} required><option value="">Select...</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.account_code} · {a.account_name}</option>)}</select></label><label><span>Debit</span><input type="number" min="0" step="0.00000001" value={x.debit} onChange={e=>set(i,"debit",e.target.value)}/></label><label><span>Credit</span><input type="number" min="0" step="0.00000001" value={x.credit} onChange={e=>set(i,"credit",e.target.value)}/></label><label><span>Line description</span><input value={x.description} onChange={e=>set(i,"description",e.target.value)}/></label><button type="button" className="text-button danger-text" onClick={()=>remove(i)}>Remove</button></div>)}</div><div className="invoice-summary"><span>Debit <strong>{debit.toFixed(2)}</strong></span><span>Credit <strong>{credit.toFixed(2)}</strong></span><span>Difference <strong>{(debit-credit).toFixed(2)}</strong></span></div>{state.error&&<p className="form-message error">{state.error}</p>}{state.success&&<p className="form-message success">{state.success}</p>}<button className="primary-button">Post journal</button></form>;
}
