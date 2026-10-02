import { ErpPageShell } from "@/components/erp-page-shell";
import { PaymentForm } from "@/components/payment-form";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { createAndPostPayment } from "@/app/erp/actions";

export default async function PaymentsPage(){
 const org=await getCurrentOrganization(),supabase=await createClient();
 const [{data:contacts},{data:accounts},{data:purchase},{data:sales},{data:expenses},{data:payments}]=await Promise.all([
  supabase.from("contacts").select("id,name,contact_number").eq("organization_id",org.id).eq("is_active",true).order("name"),
  supabase.from("accounts").select("id,account_code,account_name,account_type").eq("organization_id",org.id).eq("is_active",true).eq("is_postable",true).order("account_code"),
  supabase.from("purchase_invoices").select("id,invoice_number,total_amount,supplier_id,document_type").eq("organization_id",org.id).eq("status","posted").order("invoice_date",{ascending:false}).limit(200),
  supabase.from("sales_invoices").select("id,invoice_number,total_amount,customer_id,document_type").eq("organization_id",org.id).eq("status","posted").order("invoice_date",{ascending:false}).limit(200),
  supabase.from("expenses").select("id,expense_number,amount,contact_id").eq("organization_id",org.id).eq("status","posted").order("expense_date",{ascending:false}).limit(200),
  supabase.from("payments").select("id,payment_number,payment_type,payment_date,amount,status,contact_id,description").eq("organization_id",org.id).order("created_at",{ascending:false}).limit(100)
 ]);
 const targets=[
  ...(purchase??[]).map(x=>({id:x.id,label:x.invoice_number,document_type:x.document_type==="return"?"purchase_return":"purchase",contact_id:x.supplier_id,amount:Number(x.total_amount)})),
  ...(sales??[]).map(x=>({id:x.id,label:x.invoice_number,document_type:x.document_type==="return"?"sale_return":"sale",contact_id:x.customer_id,amount:Number(x.total_amount)})),
  ...(expenses??[]).map(x=>({id:x.id,label:x.expense_number,document_type:"expense",contact_id:x.contact_id,amount:Number(x.amount)}))
 ];
 return <ErpPageShell><div className="module-page"><div className="page-heading"><div><p className="eyebrow">Finance</p><h1>Payments</h1><p>Receipts, payments and refunds with optional allocations to posted documents.</p></div></div><section className="panel"><div className="panel-heading"><div><h2>New payment</h2><p>Payment allocation rules are enforced by the existing database validation trigger.</p></div></div><PaymentForm action={createAndPostPayment} contacts={contacts??[]} accounts={accounts??[]} targets={targets}/></section><section className="panel"><div className="panel-heading"><div><h2>Payment register</h2><p>{payments?.length??0} recent records</p></div></div><div className="data-table-scroll"><table className="data-table"><thead><tr><th>Number</th><th>Type</th><th>Date</th><th>Contact</th><th>Amount</th><th>Status</th></tr></thead><tbody>{(payments??[]).map(x=><tr key={x.id}><td>{x.payment_number}</td><td>{x.payment_type}</td><td>{x.payment_date}</td><td>{contacts?.find(c=>c.id===x.contact_id)?.name??"—"}</td><td className="numeric">{Number(x.amount).toFixed(2)}</td><td>{x.status}</td></tr>)}</tbody></table></div></section></div></ErpPageShell>;
}