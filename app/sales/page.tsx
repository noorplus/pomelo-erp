import { ErpPageShell } from "@/components/erp-page-shell";
import { InvoiceForm } from "@/components/invoice-form";
import { ActionForm } from "@/components/action-form";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { createSaleInvoice, postSales } from "@/app/erp/actions";

export default async function SalesPage() {
  const org=await getCurrentOrganization(), supabase=await createClient();
  const [{data:contacts},{data:products},{data:accounts},{data:invoices},{data:originalInvoices},{data:items}]=await Promise.all([
    supabase.from("contacts").select("id,name,contact_number").eq("organization_id",org.id).eq("is_active",true).order("name"),
    supabase.from("products").select("id,product_code,name").eq("organization_id",org.id).eq("is_active",true).order("product_code"),
    supabase.from("accounts").select("id,account_code,account_name,account_type").eq("organization_id",org.id).eq("is_postable",true).eq("is_active",true).order("account_code"),
    supabase.from("sale_invoices").select("id,invoice_number,document_type,invoice_date,status,total_amount,receivable_account_id,posted_journal_entry_id").eq("organization_id",org.id).order("created_at",{ascending:false}).limit(100),
    supabase.from("sale_invoices").select("id,invoice_number").eq("organization_id",org.id).eq("status","posted").eq("document_type","sale").order("invoice_date",{ascending:false}).limit(100),
    supabase.from("sale_items").select("id,product_id,sale_invoice_id,quantity,net_unit_cost").eq("organization_id",org.id).limit(500),
  ]);
  const originalItems=(items??[]).map(x=>({id:x.id,product_id:x.product_id,invoice_number:(originalInvoices??[]).find(i=>i.id===x.sale_invoice_id)?.invoice_number??"",label:x.id.slice(0,8)+" · "+x.product_id.slice(0,8)})).filter(x=>x.invoice_number);
  const receivable=(accounts??[]).filter(x=>x.account_type==="liability");
  return <ErpPageShell><div className="module-page"><div className="page-heading"><div><p className="eyebrow">Operations</p><h1>Sales</h1><p>Draft sales and returns, then post them through the atomic inventory and receivable workflow.</p></div></div><section className="panel"><div className="panel-heading"><div><h2>New sale</h2><p>Numbers are assigned by the existing database trigger.</p></div></div><InvoiceForm kind="sale" products={products??[]} contacts={contacts??[]} accountOptions={receivable} originals={originalItems} action={createSaleInvoice}/></section><section className="panel"><div className="panel-heading"><div><h2>Sale register</h2><p>{invoices?.length??0} recent documents</p></div></div><div className="data-table-scroll"><table className="data-table"><thead><tr><th>Invoice</th><th>Type</th><th>Date</th><th>Status</th><th>Total</th><th>Action</th></tr></thead><tbody>{(invoices??[]).map(x=><tr key={x.id}><td>{x.invoice_number}</td><td>{x.document_type}</td><td>{x.invoice_date}</td><td>{x.status}</td><td className="numeric">{Number(x.total_amount).toFixed(2)}</td><td>{x.status==="draft"?<ActionForm action={postSales} submitLabel="Post"><input type="hidden" name="id" value={x.id}/><input type="hidden" name="account_id" value={x.receivable_account_id??""}/></ActionForm>:x.posted_journal_entry_id?"Posted":"—"}</td></tr>)}</tbody></table></div></section></div></ErpPageShell>;
}