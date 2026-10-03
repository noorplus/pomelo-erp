"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/erp/types";

type Account={
  id:string;
  account_code:string;
  account_name:string;
  account_type?:string;
  normal_balance?:string;
  is_control_account?:boolean;
};

type JournalRow={account_id:string;debit:string;credit:string;description:string};

export function JournalForm({
  action,
  accounts,
  canPost=true,
  defaultEntryDate,
}:{
  action:(fd:FormData)=>Promise<ActionState>;
  accounts:Account[];
  canPost?:boolean;
  defaultEntryDate?:string;
}){
  const [entryType,setEntryType]=useState<"manual"|"opening">("manual");
  const [rows,setRows]=useState<JournalRow[]>([
    {account_id:"",debit:"",credit:"",description:""},
    {account_id:"",debit:"",credit:"",description:""},
  ]);
  const [state,setState]=useState<ActionState>({});
  const set=(i:number,k:keyof JournalRow,v:string)=>setRows(r=>r.map((x,n)=>n===i?{...x,[k]:v}:x));
  const add=()=>setRows(r=>[...r,{account_id:"",debit:"",credit:"",description:""}]);
  const remove=(i:number)=>setRows(r=>r.length<=2?r:r.filter((_,n)=>n!==i));

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!canPost) return;
    setState({});
    const fd=new FormData(e.currentTarget);
    fd.set("entry_type",entryType);
    fd.set(
      "lines_json",
      JSON.stringify(rows.map(x=>({
        account_id:x.account_id,
        debit:Number(x.debit||0),
        credit:Number(x.credit||0),
        description:x.description||undefined,
      })))
    );
    setState(await action(fd));
  }

  const debit=rows.reduce((a,x)=>a+Number(x.debit||0),0);
  const credit=rows.reduce((a,x)=>a+Number(x.credit||0),0);
  const difference=debit-credit;
  const balanced=debit>0&&Math.abs(difference)<0.00000001;

  return (
    <form className="erp-form accounting-journal-form" onSubmit={submit}>
      <div className="form-grid accounting-journal-header">
        <label>
          <span>Entry type</span>
          <select value={entryType} onChange={e=>setEntryType(e.target.value as "manual"|"opening")}>
            <option value="manual">Manual journal</option>
            <option value="opening">Opening balance</option>
          </select>
        </label>
        <label>
          <span>Entry date</span>
          <input name="entry_date" type="date" defaultValue={defaultEntryDate??new Date().toISOString().slice(0,10)} required/>
        </label>
        <label className="accounting-journal-description">
          <span>Description</span>
          <input
            name="description"
            placeholder={entryType==="opening" ? "Opening balances" : "Accounting adjustment"}
            required
          />
        </label>
      </div>

      <div className="journal-entry-help">
        {entryType==="opening"
          ? "Opening balance entries initialize the general ledger. Inventory quantity/value must be initialized separately through the inventory workflow."
          : "Manual journals are for non-operational accounting adjustments."}
      </div>

      <div className="invoice-lines journal-lines">
        <div className="panel-heading">
          <div>
            <h3>Journal lines</h3>
            <p>Use postable accounts only. Each line must contain either a debit or a credit; total debits must equal total credits.</p>
          </div>
          <button type="button" className="secondary-button compact" onClick={add} disabled={!canPost}>Add line</button>
        </div>

        <div className="journal-line-list">
          {rows.map((x,i)=>(
            <div className="journal-line" key={i}>
              <label className="journal-account-field">
                <span>Account</span>
                <select value={x.account_id} onChange={e=>set(i,"account_id",e.target.value)} required disabled={!canPost}>
                  <option value="">Select postable account...</option>
                  {accounts.map(a=>(
                    <option key={a.id} value={a.id}>
                      {a.account_code} · {a.account_name} · {a.account_type} · {a.normal_balance}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Debit</span>
                <input name={`debit_${i}`} type="number" min="0" step="0.00000001" inputMode="decimal" value={x.debit} onChange={e=>set(i,"debit",e.target.value)} disabled={!canPost}/>
              </label>
              <label>
                <span>Credit</span>
                <input name={`credit_${i}`} type="number" min="0" step="0.00000001" inputMode="decimal" value={x.credit} onChange={e=>set(i,"credit",e.target.value)} disabled={!canPost}/>
              </label>
              <label className="journal-line-description">
                <span>Line description</span>
                <input value={x.description} onChange={e=>set(i,"description",e.target.value)} disabled={!canPost}/>
              </label>
              <button type="button" className="text-button danger-text journal-remove" onClick={()=>remove(i)} disabled={!canPost||rows.length<=2}>Remove</button>
            </div>
          ))}
        </div>
      </div>

      <div className="invoice-summary journal-summary">
        <span>Debit <strong>{debit.toFixed(2)}</strong></span>
        <span>Credit <strong>{credit.toFixed(2)}</strong></span>
        <span className={balanced ? "journal-balanced" : "journal-unbalanced"}>Difference <strong>{difference.toFixed(2)}</strong></span>
      </div>

      {state.error&&<p className="form-message error">{state.error}</p>}
      {state.success&&<p className="form-message success">{state.success}</p>}

      <button className="primary-button" disabled={!canPost||!balanced}>
        {entryType==="opening" ? "Post opening balance" : "Post journal"}
      </button>
    </form>
  );
}
