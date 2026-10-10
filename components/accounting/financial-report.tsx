import { PageHeader, PageSection } from "@/components/ui";
import { FinancialReportTable } from "@/components/accounting/financial-report-table";
import { formatCurrency } from "@/lib/formatters";

type ReportRow = { id: string; account_code: string; account_name: string; account_type: string; debit: number; credit: number; balance: number; is_control_account: boolean };

export function FinancialReport({
  title, description, rows, filter, periods, from, to, periodId, variant = "ledger", currency = "BDT",
}: {
  title: string; description: string; rows: ReportRow[]; filter: (row: ReportRow) => boolean;
  periods: Array<{ id: string; name: string; start_date: string; end_date: string; status: string }>;
  from?: string; to?: string; periodId?: string; currency?: string; variant?: "trial" | "profit-loss" | "balance-sheet" | "receivables-payables" | "ledger";
}) {
  const data = rows.filter(filter);
  const revenue = data.filter((r) => r.account_type === "REVENUE").reduce((s, r) => s + r.balance, 0);
  const expenses = data.filter((r) => r.account_type === "EXPENSE").reduce((s, r) => s + r.balance, 0);
  const netIncome = revenue - expenses;
  const assets = data.filter((r) => r.account_type === "ASSET").reduce((s, r) => s + r.balance, 0);
  const liabilities = data.filter((r) => r.account_type === "LIABILITY").reduce((s, r) => s + r.balance, 0);
  const equity = data.filter((r) => r.account_type === "EQUITY").reduce((s, r) => s + r.balance, 0);
  const trialDebit = data.reduce((s, r) => s + r.debit, 0);
  const trialCredit = data.reduce((s, r) => s + r.credit, 0);
  const money = (value: number) => formatCurrency(value, currency);

  return <div className="page">
    <PageHeader eyebrow="Accounting / Reports" title={title} description={description} />
    <PageSection title="Report filters">
      <form className="ui-form-grid" method="get">
        <label className="ui-field"><span className="ui-field-label">Accounting period</span><select className="ui-input" name="period"><option value="">All posted activity</option>{periods.map((p) => <option key={p.id} value={p.id} selected={p.id === periodId}>{p.name} · {p.start_date} to {p.end_date}</option>)}</select></label>
        <label className="ui-field"><span className="ui-field-label">From</span><input className="ui-input" type="date" name="from" defaultValue={from ?? ""} /></label>
        <label className="ui-field"><span className="ui-field-label">To</span><input className="ui-input" type="date" name="to" defaultValue={to ?? ""} /></label>
        <div className="ui-field"><span className="ui-field-label">&nbsp;</span><button className="button primary" type="submit">Apply filters</button></div>
      </form>
      <p className="ui-field-hint">Only CONFIRMED journal activity is included. Draft and cancelled entries are excluded.</p>
    </PageSection>
    <PageSection title="Accounts">
      <FinancialReportTable rows={data} currency={currency} />
    </PageSection>
    <PageSection title="Summary">
      {variant === "trial" ? <div className="ui-detail-grid"><div><span>Total debit</span><strong>{money(trialDebit)}</strong></div><div><span>Total credit</span><strong>{money(trialCredit)}</strong></div><div><span>Difference</span><strong>{money(trialDebit - trialCredit)}</strong></div></div> : null}
      {variant === "profit-loss" ? <div className="ui-detail-grid"><div><span>Revenue</span><strong>{money(revenue)}</strong></div><div><span>Expenses</span><strong>{money(expenses)}</strong></div><div><span>Net income</span><strong>{money(netIncome)}</strong></div></div> : null}
      {variant === "balance-sheet" ? <div className="ui-detail-grid"><div><span>Assets</span><strong>{money(assets)}</strong></div><div><span>Liabilities</span><strong>{money(liabilities)}</strong></div><div><span>Equity</span><strong>{money(equity)}</strong></div><div><span>Equity + net income</span><strong>{money(equity + netIncome)}</strong></div><div><span>Balance difference</span><strong>{money(assets - liabilities - equity - netIncome)}</strong></div></div> : null}
      {variant === "receivables-payables" ? <div className="ui-detail-grid"><div><span>Receivables</span><strong>{money(data.filter((r) => r.account_type === "ASSET").reduce((s, r) => s + r.balance, 0))}</strong></div><div><span>Payables</span><strong>{money(data.filter((r) => r.account_type === "LIABILITY").reduce((s, r) => s + r.balance, 0))}</strong></div></div> : null}
      {variant === "ledger" ? <div><strong>{data.length}</strong> accounts</div> : null}
    </PageSection>
  </div>;
}
