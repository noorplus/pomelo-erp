import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, BookOpen, Contact, FileText, Package, Receipt, ShoppingCart, Wallet } from "lucide-react";
import { EmptyState, PageHeader, PageSection, StatusBadge } from "@/components/ui";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import type { DashboardData } from "@/lib/dashboard/queries";

const activityMeta = {
  sale: { label: "Sales invoice", icon: Receipt },
  purchase: { label: "Purchase invoice", icon: ShoppingCart },
  "sales-return": { label: "Sales return", icon: ArrowDownLeft },
  "purchase-return": { label: "Purchase return", icon: ArrowUpRight },
  payment: { label: "Payment", icon: Wallet },
  expense: { label: "Expense", icon: FileText },
  journal: { label: "Journal entry", icon: BookOpen },
} as const;

function MetricCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href} className="dashboard-metric-card" aria-label={`${label}: ${value}. ${detail}`}>
      <div className="dashboard-metric-heading">
        <span className="dashboard-metric-label">{label}</span>
        <strong className="dashboard-metric-value">{value}</strong>
      </div>
      <span className="dashboard-metric-detail" title={detail}>{detail}</span>
    </Link>
  );
}

export function DashboardOverview({
  organizationName,
  data,
}: {
  organizationName: string;
  data: DashboardData;
}) {
  const maxTrendValue = Math.max(1, ...data.trend.flatMap((month) => [month.sales, month.purchases]));
  const currentMonthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${data.currentMonthStart}T00:00:00Z`));

  return (
    <section className="page dashboard-page">
      <PageHeader
        eyebrow="Business overview"
        title="Dashboard"
        description={`${organizationName} · ${currentMonthLabel}`}
        actions={
          <>
            <Link className="button" href="/sales/invoices/new">New sale</Link>
            <Link className="button primary" href="/purchase/invoices/new">New purchase</Link>
          </>
        }
      />

      <div className="dashboard-metrics">
        <MetricCard label="Net sales" value={formatCurrency(data.metrics.netSales, data.currency)} detail="Confirmed sales less confirmed returns this month" href="/sales/invoices" />
        <MetricCard label="Net purchases" value={formatCurrency(data.metrics.netPurchases, data.currency)} detail="Confirmed purchases less confirmed returns this month" href="/purchase/invoices" />
        <MetricCard label="Inventory value" value={formatCurrency(data.metrics.inventoryValue, data.currency)} detail="Current value from inventory balances" href="/inventory/stock" />
        <MetricCard label="Draft documents" value={formatNumber(data.metrics.openDrafts)} detail="Sales, purchase, payment and expense drafts" href="/sales/invoices" />
      </div>

      <div className="dashboard-main-grid">
        <PageSection title="Business activity" description="Net sales and purchases over the last six months.">
          <div className="dashboard-panel dashboard-chart-panel">
            <div className="dashboard-chart-legend">
              <span><i className="dashboard-legend-dot dashboard-legend-sales" /> Net sales</span>
              <span><i className="dashboard-legend-dot dashboard-legend-purchases" /> Net purchases</span>
            </div>
            <div className="dashboard-chart" role="img" aria-label="Monthly net sales and net purchases for the last six months">
              {data.trend.map((month) => {
                const salesHeight = month.sales > 0 ? Math.max(4, (month.sales / maxTrendValue) * 100) : 0;
                const purchaseHeight = month.purchases > 0 ? Math.max(4, (month.purchases / maxTrendValue) * 100) : 0;
                return (
                  <div className="dashboard-chart-month" key={month.key}>
                    <div className="dashboard-chart-bars">
                      <span className="dashboard-chart-bar dashboard-chart-bar-sales" style={{ height: `${salesHeight}%` }} title={`Net sales: ${formatCurrency(month.sales, data.currency)}`} />
                      <span className="dashboard-chart-bar dashboard-chart-bar-purchases" style={{ height: `${purchaseHeight}%` }} title={`Net purchases: ${formatCurrency(month.purchases, data.currency)}`} />
                    </div>
                    <span className="dashboard-chart-label">{month.label}</span>
                  </div>
                );
              })}
            </div>
            <p className="dashboard-chart-footnote">Figures include confirmed documents only and subtract confirmed returns. Draft and cancelled documents are excluded.</p>
          </div>
        </PageSection>

        <PageSection title="Workspace health" description="Active master data and accounting setup.">
          <div className="dashboard-panel dashboard-health-list">
            <Link href="/contacts" className="dashboard-health-row">
              <span className="dashboard-health-icon"><Contact size={17} aria-hidden="true" /></span>
              <span><strong>Active contacts</strong><small>Customers and suppliers</small></span>
              <b>{formatNumber(data.metrics.activeContacts)}</b>
            </Link>
            <Link href="/products" className="dashboard-health-row">
              <span className="dashboard-health-icon"><Package size={17} aria-hidden="true" /></span>
              <span><strong>Active products</strong><small>Items available for transactions</small></span>
              <b>{formatNumber(data.metrics.activeProducts)}</b>
            </Link>
            <Link href="/accounting/accounts" className="dashboard-health-row">
              <span className="dashboard-health-icon"><BookOpen size={17} aria-hidden="true" /></span>
              <span><strong>Active accounts</strong><small>Chart of accounts</small></span>
              <b>{formatNumber(data.metrics.activeAccounts)}</b>
            </Link>
            <Link href="/accounting/periods" className="dashboard-health-row">
              <span className="dashboard-health-icon"><Wallet size={17} aria-hidden="true" /></span>
              <span><strong>Open periods</strong><small>Accounting periods accepting entries</small></span>
              <b>{formatNumber(data.metrics.openPeriods)}</b>
            </Link>
          </div>
        </PageSection>
      </div>

      <PageSection title="Recent activity" description="Latest confirmed sales, purchases, returns, payments, expenses and journal entries." actions={<Link className="button" href="/accounting/transactions/journal-entries">View journals</Link>}>
        <div className="dashboard-panel dashboard-activity">
          {data.recentActivity.length ? data.recentActivity.map((activity) => {
            const meta = activityMeta[activity.kind];
            const Icon = meta.icon;
            return (
              <Link className="dashboard-activity-row" href={activity.href} key={activity.id}>
                <span className="dashboard-activity-icon"><Icon size={17} aria-hidden="true" /></span>
                <span className="dashboard-activity-copy">
                  <strong>{activity.label}</strong>
                  <small>{meta.label} · {formatDate(activity.date)}</small>
                </span>
                <span className="dashboard-activity-amount">
                  {activity.amount === null ? <StatusBadge tone="success">Posted</StatusBadge> : (
                    <strong className={activity.amount < 0 ? "dashboard-amount-negative" : "dashboard-amount-positive"}>
                      {activity.amount < 0 ? "−" : "+"}{formatCurrency(Math.abs(activity.amount), data.currency)}
                    </strong>
                  )}
                </span>
              </Link>
            );
          }) : <EmptyState title="No confirmed activity yet" description="Confirmed sales, purchases and accounting transactions will appear here." />}
        </div>
      </PageSection>
    </section>
  );
}
