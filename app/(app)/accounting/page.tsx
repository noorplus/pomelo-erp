import Link from "next/link";
import { getApplicationContext } from "@/lib/organizations/server";
import { createClient } from "@/lib/supabase/server";
import { getAccountingDashboard } from "@/lib/accounting/queries";
import { DataTable, PageHeader, PageSection, StatusBadge } from "@/components/ui";

function money(value: number) {
  return new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export default async function AccountingDashboardPage() {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;

  const dashboard = await getAccountingDashboard(await createClient(), context.activeOrganization.id);
  const { metrics, openPeriod } = dashboard;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Accounting"
        title="Dashboard"
        description="Financial activity and accounting status from the current organization data."
      />

      <section className="ui-stats-grid">
        <div className="content-card">
          <span className="lede">Active accounts</span>
          <strong className="ui-stat-value">{metrics.activeAccounts}</strong>
          <span className="lede">{metrics.totalAccounts} total accounts</span>
        </div>
        <div className="content-card">
          <span className="lede">Posted journal entries</span>
          <strong className="ui-stat-value">{metrics.postedJournalEntries}</strong>
          <span className="lede">{openPeriod?.name ?? "No open period"}</span>
        </div>
        <div className="content-card">
          <span className="lede">Open periods</span>
          <strong className="ui-stat-value">{metrics.openPeriods}</strong>
          <span className="lede">{openPeriod ? `${openPeriod.start_date} to ${openPeriod.end_date}` : "Set an accounting period"}</span>
        </div>
        <div className="content-card">
          <span className="lede">Debits</span>
          <strong className="ui-stat-value">{money(metrics.debitTotal)}</strong>
          <span className="lede">Current accounting period</span>
        </div>
        <div className="content-card">
          <span className="lede">Credits</span>
          <strong className="ui-stat-value">{money(metrics.creditTotal)}</strong>
          <span className="lede">Current accounting period</span>
        </div>
        <div className="content-card">
          <span className="lede">Payments / Expenses</span>
          <strong className="ui-stat-value">{money(metrics.confirmedPayments)} / {money(metrics.confirmedExpenses)}</strong>
          <span className="lede">Confirmed activity in period</span>
        </div>
      </section>

      <PageSection
        title="Accounting setup"
        description="Use the existing database-backed accounting configuration."
        actions={
          <div className="ui-page-header-actions">
            <Link className="button" href="/accounting/accounts">Chart of Accounts</Link>
            <Link className="button" href="/accounting/periods">Periods</Link>
          </div>
        }
      >
        {openPeriod ? (
          <div className="content-card">
            <div className="ui-detail-grid">
              <div><span>Current period</span><strong>{openPeriod.name}</strong></div>
              <div><span>Start date</span><strong>{openPeriod.start_date}</strong></div>
              <div><span>End date</span><strong>{openPeriod.end_date}</strong></div>
            </div>
          </div>
        ) : (
          <div className="ui-state ui-empty-state">
            <strong>No open accounting period</strong>
            <p>Create or open an accounting period before posting period-based accounting activity.</p>
          </div>
        )}
      </PageSection>

      <PageSection title="Recent journal entries" description="Latest journal entries recorded for the organization.">
        <DataTable
          rows={dashboard.recentJournalEntries}
          columns={[
            { key: "number", header: "Entry", render: (entry) => <Link href={`/accounting/transactions/journal-entries/${entry.id}`}>{entry.entry_number}</Link> },
            { key: "date", header: "Date", render: (entry) => entry.entry_date },
            { key: "type", header: "Type", render: (entry) => entry.entry_type },
            { key: "status", header: "Status", render: (entry) => <StatusBadge tone={entry.status === "CONFIRMED" ? "success" : entry.status === "CANCELLED" ? "danger" : "neutral"}>{entry.status}</StatusBadge> },
            { key: "description", header: "Description", render: (entry) => entry.description ?? "—" },
          ]}
          empty="No journal entries found."
        />
      </PageSection>
    </div>
  );
}
