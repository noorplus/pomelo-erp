import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DataTable, PageHeader, PageSection, StatusBadge } from "@/components/ui";
import type { Tables } from "@/lib/supabase/database";

type Product = Tables<"products">;
type Unit = { id: string; name: string; is_active: boolean } | null;
type Account = { id: string; account_code: string; account_name: string; account_type: string; is_postable: boolean; is_active: boolean } | null;
type Inventory = Tables<"inventory_balances"> | null;
type Activity = {
  purchases: Array<{ id: string; purchase_id: string; quantity: number; unit_cost: number; line_total: number; purchase: { invoice_id: string | null; invoice_date: string; status: string } }>;
  sales: Array<{ id: string; sales_id: string; quantity: number; unit_price: number; line_total: number; cogs_unit_cost: number; cogs_total: number; sales: { invoice_id: string | null; invoice_date: string; status: string } }>;
  purchaseReturns: Array<{ id: string; purchase_return_id: string; quantity: number; unit_cost: number; line_total: number; purchase_returns: { return_number: string | null; return_date: string; status: string } }>;
  salesReturns: Array<{ id: string; sales_return_id: string; quantity: number; unit_price: number; line_total: number; sales_returns: { return_number: string | null; return_date: string; status: string } }>;
};

const money = (value: number) => value.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tone = (status: string) => status === "CONFIRMED" ? "success" : status === "CANCELLED" ? "danger" : "neutral";

export function ProductDetail({ product, unit, inventory, inventoryAccount, salesAccount, cogsAccount, activity }: {
  product: Product; unit: Unit; inventory: Inventory; inventoryAccount: Account; salesAccount: Account; cogsAccount: Account; activity: Activity;
}) {
  const purchaseQty = activity.purchases.filter(x => x.purchase.status === "CONFIRMED").reduce((n, x) => n + Number(x.quantity), 0);
  const salesQty = activity.sales.filter(x => x.sales.status === "CONFIRMED").reduce((n, x) => n + Number(x.quantity), 0);
  const purchaseReturnQty = activity.purchaseReturns.filter(x => x.purchase_returns.status === "CONFIRMED").reduce((n, x) => n + Number(x.quantity), 0);
  const salesReturnQty = activity.salesReturns.filter(x => x.sales_returns.status === "CONFIRMED").reduce((n, x) => n + Number(x.quantity), 0);

  return <div className="page products-detail-page">
    <PageHeader eyebrow="Products" title={product.name} description={product.product_code ?? "Product details"} actions={<Link className="button" href="/products"><ArrowLeft size={16} /> Products</Link>} />
    <section className="ui-stats-grid">
      <div className="content-card"><span className="lede">On hand</span><strong className="ui-stat-value">{Number(inventory?.quantity ?? 0).toLocaleString()}</strong><span className="lede">{unit?.name ?? ""}</span></div>
      <div className="content-card"><span className="lede">Inventory value</span><strong className="ui-stat-value">{money(Number(inventory?.inventory_value ?? 0))}</strong></div>
      <div className="content-card"><span className="lede">Confirmed purchased</span><strong className="ui-stat-value">{purchaseQty.toLocaleString()}</strong></div>
      <div className="content-card"><span className="lede">Confirmed sold</span><strong className="ui-stat-value">{salesQty.toLocaleString()}</strong></div>
    </section>
    <PageSection title="Product details" actions={<StatusBadge tone={product.is_active ? "success" : "neutral"}>{product.is_active ? "Active" : "Inactive"}</StatusBadge>}>
      <div className="ui-detail-grid">
        <div><span>Product code</span><strong>{product.product_code ?? "—"}</strong></div><div><span>Name</span><strong>{product.name}</strong></div><div><span>Unit</span><strong>{unit?.name ?? "—"}</strong></div>
        <div><span>Average cost</span><strong>{money(Number(inventory?.average_cost ?? 0))}</strong></div><div><span>Purchase returns</span><strong>{purchaseReturnQty.toLocaleString()} {unit?.name ?? ""}</strong></div><div><span>Sales returns</span><strong>{salesReturnQty.toLocaleString()} {unit?.name ?? ""}</strong></div>
      </div>
    </PageSection>
    <PageSection title="Accounting configuration">
      <div className="ui-detail-grid">
        <div><span>Inventory account</span><strong>{inventoryAccount ? `${inventoryAccount.account_code} — ${inventoryAccount.account_name}` : "—"}</strong></div>
        <div><span>Sales account</span><strong>{salesAccount ? `${salesAccount.account_code} — ${salesAccount.account_name}` : "—"}</strong></div>
        <div><span>COGS account</span><strong>{cogsAccount ? `${cogsAccount.account_code} — ${cogsAccount.account_name}` : "—"}</strong></div>
      </div>
    </PageSection>
    <PageSection title="Purchase history">
      <DataTable rows={activity.purchases} columns={[
        {key:"invoice",header:"Invoice",render:r=><Link href={`/purchase/invoices/${r.purchase_id}`}>{r.purchase.invoice_id??r.purchase_id}</Link>},
        {key:"date",header:"Date",render:r=>r.purchase.invoice_date},{key:"qty",header:"Qty",render:r=>Number(r.quantity).toLocaleString()},{key:"cost",header:"Unit cost",render:r=>money(Number(r.unit_cost))},
        {key:"total",header:"Total",render:r=>money(Number(r.line_total))},{key:"status",header:"Status",render:r=><StatusBadge tone={tone(r.purchase.status)}>{r.purchase.status}</StatusBadge>}
      ]} empty="No purchase lines found." />
    </PageSection>
    <PageSection title="Sales history">
      <DataTable rows={activity.sales} columns={[
        {key:"invoice",header:"Invoice",render:r=><Link href={`/sales/invoices/${r.sales_id}`}>{r.sales.invoice_id??r.sales_id}</Link>},
        {key:"date",header:"Date",render:r=>r.sales.invoice_date},{key:"qty",header:"Qty",render:r=>Number(r.quantity).toLocaleString()},{key:"price",header:"Unit price",render:r=>money(Number(r.unit_price))},
        {key:"cogs",header:"COGS",render:r=>money(Number(r.cogs_total))},{key:"total",header:"Total",render:r=>money(Number(r.line_total))},{key:"status",header:"Status",render:r=><StatusBadge tone={tone(r.sales.status)}>{r.sales.status}</StatusBadge>}
      ]} empty="No sales lines found." />
    </PageSection>
    <PageSection title="Returns" description="Return quantities are shown from the frozen return tables; confirmation determines their inventory effect.">
      <DataTable rows={[...activity.purchaseReturns.map(r=>({...r, kind:"Purchase return"})),...activity.salesReturns.map(r=>({...r, kind:"Sales return"}))]} columns={[
        {key:"kind",header:"Type",render:r=>r.kind},{key:"date",header:"Date",render:r=>"purchase_returns" in r?r.purchase_returns.return_date:r.sales_returns.return_date},
        {key:"qty",header:"Qty",render:r=>Number(r.quantity).toLocaleString()},{key:"total",header:"Total",render:r=>money(Number(r.line_total))},
        {key:"status",header:"Status",render:r=>{const s="purchase_returns" in r?r.purchase_returns.status:r.sales_returns.status;return <StatusBadge tone={tone(s)}>{s}</StatusBadge>}}
      ]} empty="No return lines found." />
    </PageSection>
  </div>;
}