"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/erp/types";

type Product={id:string;product_code:string;name:string};
type Account={id:string;account_code:string;account_name:string;account_type:string};

export function InventoryAdjustmentForm({
  products,accounts,canPost,action
}:{products:Product[];accounts:Account[];canPost:boolean;action:(fd:FormData)=>Promise<ActionState>}){
  const [direction,setDirection]=useState<"in"|"out">("in");
  const [state,setState]=useState<ActionState>({});
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setState({});
    const result=await action(new FormData(e.currentTarget));setState(result);
    if(result.success)e.currentTarget.reset();
  }
  return <section className="panel">
    <div className="panel-heading"><div><h2>Stock adjustment</h2><p>Uses the existing transactional RPC. IN uses the supplied unit cost; OUT uses current WAC.</p></div></div>
    {!canPost&&<p className="form-message error">Your role is not authorized to post inventory adjustments.</p>}
    <form className="erp-form" onSubmit={submit}>
      <div className="form-grid">
        <label><span>Product</span><select name="product_id" required disabled={!canPost}><option value="">Select...</option>{products.map(x=><option key={x.id} value={x.id}>{x.product_code} · {x.name}</option>)}</select></label>
        <label><span>Direction</span><select name="direction" value={direction} onChange={e=>setDirection(e.target.value as "in"|"out")} disabled={!canPost}><option value="in">IN — increase stock</option><option value="out">OUT — decrease stock</option></select></label>
        <label><span>Date</span><input name="transaction_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required disabled={!canPost}/></label>
        <label><span>Quantity</span><input name="quantity" type="number" min="0.00000001" step="0.00000001" required disabled={!canPost}/></label>
        {direction==="in"&&<label><span>Unit cost</span><input name="unit_cost" type="number" min="0" step="0.00000001" required disabled={!canPost}/></label>}
        <label><span>Offset account</span><select name="offset_account_id" required disabled={!canPost}><option value="">Select...</option>{accounts.map(x=><option key={x.id} value={x.id}>{x.account_code} · {x.account_name}</option>)}</select></label>
        <label><span>Description</span><input name="description" placeholder="Reason / reference" disabled={!canPost}/></label>
      </div>
      {state.error&&<p className="form-message error">{state.error}</p>}{state.success&&<p className="form-message success">{state.success}</p>}
      <button className="primary-button" disabled={!canPost}>{direction==="in"?"Post stock IN":"Post stock OUT"}</button>
    </form>
  </section>;
}
