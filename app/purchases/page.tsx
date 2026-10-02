import { ErpPageShell } from "@/components/erp-page-shell";
import { InvoiceForm } from "@/components/invoice-form";
import { ActionForm } from "@/components/action-form";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { createPurchaseInvoice, postPurchase } from "@/app/erp/actions";

export default async function PurchasesPage() {
  const org=await getCurrentOrganization(), supabase=await createClient();
  const [{data:contacts},{data:products},{data:accounts},{data:invoices},{data:originalInvoices},{data:items}]=await Promise.all([
    supabase.from("contacts").select("id,name,contact_number").eq("organization_id",org.id).eq("is_active",true).order("name"),
    supabase.from("products").select("id,product_code,name").eq("organization_id",org.id).eq("is_active",true).order("product_code"),
    supabase.from("accounts").select("id,account_code,account_name,account_type").eq("organization_id",org.id).eq("is_postable",true).eq("is_active",true).order("account_code"),
    supabase.from("purchase_invoices").select("id,invoice_number,document_type,invoice_date,status,total_amount,payable_account_id,posted_journal_entry_id").eq("organization_id",org.id).order("created_at",{ascending:false}).limit(100),
    supabase.from("purchase_invoices").select("id,invoice_number").eq("organization_id",org.id).eq("status","posted").eq("document_type","purchase").order("invoice_date",{ascending:false}).limit(100),
    supabase.from("purchase_items").select("id,product_id,purchase_invoice_id,quantity,net_unit_cost").eq("organization_id",org.id).limit(500),
  ]);
  const productLabels=new Map((products??[]).map(p=>[p.id,p.product_code+" · "+p.name]));
  const originalItems=(items??[]).map(x=>({id:x.id,product_id:x.product_id,invoice_id:x.purchase_invoice_id,invoice_number:(originalInvoices??[]).find(i=>i.id===x.purchase_invoice_id)?.invoice_number??"",label:productLabels.get(x.product_id)??x.product_id.slice(0,8),unit:Number(x.net_unit_cost)})).filter(x=>x.invoice_number);
  const payable=(accounts??[]).filter(x=>x.account_type==="liability");
  return <ErpPageShell><div className="module-page"><div className="page-heading"><div><p className="eyebrow">Operations</p><h1>Purchases</h1><p>Draft purchases and returns, then post them through the atomic inventory and payable workflow.</p></div></div><section className="panel"><div className="panel-heading"><div><h2>New purchase</h2><p>Numbers are assigned by the existing database trigger.</p></div></div><InvoiceForm kind="purchase" products={products??[]} contacts={contacts??[]} accountOptions={payable} originals={originalItems} action={createPurchaseInvoice}/></section><section className="panel"><div className="panel-heading"><div><h2>Purchase register</h2><p>{invoices?.length??0} recent documents</p></div></div><div className="data-table-scroll"><table className="data-table"><thead><tr><th>Invoice</th><th>Type</th><th>Date</th><th>Status</th><th>Total</th><th>Action</th></tr></thead><tbody>{(invoices??[]).map(x=><tr key={x.id}><td>{x.invoice_number}</td><td>{x.document_type}</td><td>{x.invoice_date}</td><td>{x.status}</td><td className="numeric">{Number(x.total_amount).toFixed(2)}</td><td>{x.status==="draft"?<ActionForm action={postPurchase} submitLabel="Post"><input type="hidden" name="id" value={x.id}/><input type="hidden" name="account_id" value={x.payable_account_id??""}/></ActionForm>:x.posted_journal_entry_id?"Posted":"—"}</td></tr>)}</tbody></table></div></section></div></ErpPageShell>;
}