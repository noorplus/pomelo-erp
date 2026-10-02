"use client";

import { useState } from "react";
import type { ActionState } from "@/app/erp/actions";

type Product = { id: string; product_code: string; name: string };
type OriginalItem = { id: string; product_id: string; invoice_number: string; label: string };

export function InvoiceForm({
  kind, products, originals, action, accountOptions, contacts,
}: {
  kind: "purchase" | "sale";
  products: Product[];
  originals: OriginalItem[];
  action: (fd: FormData) => Promise<ActionState>;
  accountOptions: { id: string; account_code: string; account_name: string }[];
  contacts: { id: string; name: string; contact_number: string }[];
}) {
  const [type, setType] = useState<"purchase" | "sale" | "return">(kind);
  const [contact, setContact] = useState("");
  const [account, setAccount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [originalInvoice, setOriginalInvoice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [lines, setLines] = useState([{ product_id:"", quantity:"1", unit:"0", original_item_id:"" }]);
  const [state, setState] = useState<ActionState>({});

  const addLine=()=>setLines(v=>[...v,{product_id:"",quantity:"1",unit:"0",original_item_id:""}]);
  const update=(i:number,key:string,value:string)=>setLines(v=>v.map((x,n)=>n===i?{...x,[key]:value}:x));
  const remove=(i:number)=>setLines(v=>v.length===1?v:v.filter((_,n)=>n!==i));
  const selectedOriginals=originals.filter(x=>!originalInvoice || x.invoice_number===originalInvoice);
  const subtotal=lines.reduce((a,x)=>a+(Number(x.quantity)||0)*(Number(x.unit)||0),0);
  const total=Math.max(0,subtotal-(type==="return"?0:Number(discount)||0));

  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setState({});
    const fd=new FormData(e.currentTarget);
    fd.set("document_type",type);
    fd.set(kind==="purchase"?"supplier_id":"customer_id",contact);
    fd.set(kind==="purchase"?"payable_account_id":"receivable_account_id",account);
    fd.set("invoice_date",date);
    fd.set("original_invoice_id",type==="return"?originalInvoice:"");
    fd.set("discount_amount",type==="return"?"0":discount);
    fd.set("items_json",JSON.stringify(lines.map(x=>({product_id:x.product_id,quantity:Number(x.quantity),[kind==="purchase"?"unit_cost":"unit_price"]:Number(x.unit),original_item_id:x.original_item_id||undefined}))));
    const result=await action(fd); setState(result);
    if(result.success){ setLines([{product_id:"",quantity:"1",unit:"0",original_item_id:""}]); setDiscount("0"); setOriginalInvoice(""); }
  }

  return <form className="erp-form invoice-builder" onSubmit={submit}>
    <div className="form-grid">
      <label><span>Document type</span><select value={type} onChange={e=>setType(e.target.value as "purchase"|"sale"|"return")}><option value={kind}>{kind==="purchase"?"Purchase":"Sale"}</option><option value="return">Return</option></select></label>
      <label><span>{kind==="purchase"?"Supplier":"Customer"}</span><select value={contact} onChange={e=>setContact(e.target.value)} required><option value="">Select...</option>{contacts.map(x=><option key={x.id} value={x.id}>{x.contact_number} · {x.name}</option>)}</select></label>
      <label><span>{kind==="purchase"?"Payable":"Receivable"} account</span><select value={account} onChange={e=>setAccount(e.target.value)} required><option value="">Select...</option>{accountOptions.map(x=><option key={x.id} value={x.id}>{x.account_code} · {x.account_name}</option>)}</select></label>
      <label><span>Invoice date</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></label>
      {type==="return" && <label><span>Original invoice</span><select value={originalInvoice} onChange={e=>setOriginalInvoice(e.target.value)} required><option value="">Select posted invoice...</option>{Array.from(new Set(originals.map(x=>x.invoice_number))).map(x=><option key={x} value={x}>{x}</option>)}</select></label>}
      {type!=="return" && <label><span>Invoice discount</span><input type="number" min="0" step="0.00000001" value={discount} onChange={e=>setDiscount(e.target.value)} /></label>}
    </div>
    <div className="invoice-lines">
      <div className="panel-heading"><div><h3>Lines</h3><p>Invoice-level discount is distributed per quantity to satisfy the posting invariant.</p></div><button type="button" className="secondary-button compact" onClick={addLine}>Add line</button></div>
      {lines.map((line,i)=><div className="invoice-line" key={i}>
        {type==="return" ? <label><span>Original item</span><select value={line.original_item_id} onChange={e=>{update(i,"original_item_id",e.target.value);const x=originals.find(o=>o.id===e.target.value);if(x)update(i,"product_id",x.product_id)}} required><option value="">Select...</option>{selectedOriginals.map(x=><option key={x.id} value={x.id}>{x.invoice_number} · {x.label}</option>)}</select></label>
        : <label><span>Product</span><select value={line.product_id} onChange={e=>update(i,"product_id",e.target.value)} required><option value="">Select...</option>{products.map(x=><option key={x.id} value={x.id}>{x.product_code} · {x.name}</option>)}</select></label>}
        <label><span>Qty</span><input type="number" min="0.00000001" step="0.00000001" value={line.quantity} onChange={e=>update(i,"quantity",e.target.value)} required /></label>
        {type!=="return" && <label><span>{kind==="purchase"?"Unit cost":"Unit price"}</span><input type="number" min="0" step="0.00000001" value={line.unit} onChange={e=>update(i,"unit",e.target.value)} required /></label>}
        <label><span>Line total</span><input value={((Number(line.quantity)||0)*(Number(line.unit)||0)).toFixed(2)} readOnly /></label>
        <button type="button" className="text-button danger-text" onClick={()=>remove(i)}>Remove</button>
      </div>)}
    </div>
    <div className="invoice-summary"><span>Subtotal <strong>{subtotal.toFixed(2)}</strong></span><span>Total <strong>{total.toFixed(2)}</strong></span></div>
    {state.error&&<p className="form-message error">{state.error}</p>}{state.success&&<p className="form-message success">{state.success}</p>}
    <button className="primary-button">Create {type==="return"?"return draft":kind==="purchase"?"purchase draft":"sales draft"}</button>
  </form>;
}
