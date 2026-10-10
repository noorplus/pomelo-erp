import Link from "next/link";
import { ArrowRight, FilePlus2, RotateCcw, ReceiptText } from "lucide-react";
import { PageHeader, PageSection, StatusBadge } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/formatters";


export function SalesDashboard({ data, currency = "BDT" }: { data: { invoiceCount: number; invoiceTotal: number; draftCount: number; returnCount: number; returnTotal: number; recent: Array<{ id: string; total_amount: number | string; status: string; invoice_date: string }> }; currency?: string }) {
  const money = (n: number) => formatCurrency(n, currency);
  return <div className="page">
    <PageHeader eyebrow="Sales" title="Sales dashboard" description="Monitor invoices, returns and the sales flow for the active organization." actions={<div className="ui-page-header-actions"><Link className="button" href="/sales/invoices">Invoices</Link><Link className="button primary" href="/sales/invoices/new"><FilePlus2 size={16}/> New sale</Link></div>} />
    <PageSection title="Sales summary" description="Confirmed document values for the active organization."><div className="ui-detail-grid">
      <div><span>Confirmed invoices</span><strong>{data.invoiceCount}</strong><span>{money(data.invoiceTotal)}</span></div>
      <div><span>Draft invoices</span><strong>{data.draftCount}</strong><span>Awaiting confirmation</span></div>
      <div><span>Confirmed returns</span><strong>{data.returnCount}</strong><span>{money(data.returnTotal)}</span></div>
    </div></PageSection>
    <PageSection title="Sales workflow" description="Create drafts first; confirmation performs the existing inventory and accounting posting logic.">
      <div className="ui-action-grid">
        <Link className="content-card" href="/sales/invoices"><ReceiptText size={20}/><strong>Sales invoices</strong><span>Review drafts, confirmed invoices and cancelled documents.</span><ArrowRight size={16}/></Link>
        <Link className="content-card" href="/sales/returns"><RotateCcw size={20}/><strong>Sales returns</strong><span>Process returns against confirmed sales.</span><ArrowRight size={16}/></Link>
      </div>
    </PageSection>
    <PageSection title="Recent sales">
      <div className="ui-list">{data.recent.map((x) => <Link className="ui-list-row" key={x.id} href={"/sales/invoices/"+x.id}><span>{formatDate(x.invoice_date)}</span><span>{money(Number(x.total_amount))}</span><StatusBadge tone={x.status === "CONFIRMED" ? "success" : x.status === "CANCELLED" ? "danger" : "neutral"}>{x.status}</StatusBadge></Link>)}</div>
    </PageSection>
  </div>;
}
