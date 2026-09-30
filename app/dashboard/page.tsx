import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const modules = [
  { title: "Sales", description: "Invoices, returns, receivables", href: "/dashboard/sales", action: "Open sales" },
  { title: "Purchasing", description: "Supplier invoices, returns, payables", href: "/dashboard/purchases", action: "Open purchasing" },
  { title: "Inventory", description: "Stock balances, movements, valuation", href: "/dashboard/inventory", action: "View inventory" },
  { title: "Accounting", description: "Journals, ledger, periods, balances", href: "/dashboard/accounting", action: "Open accounting" },
];

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: products }, { count: contacts }, { count: accounts }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("accounts").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="dashboard">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Good to see you.</h1>
          <p>Run day-to-day operations from one transactional ERP workspace.</p>
        </div>
        <div className="heading-actions">
          <Link href="/dashboard/sales" className="primary-button compact">New sale</Link>
          <Link href="/dashboard/purchases" className="secondary-button compact">New purchase</Link>
        </div>
      </section>

      <section className="metric-grid" aria-label="Master data">
        <article className="metric-card"><span>Products</span><strong>{products ?? 0}</strong><small>Inventory master</small></article>
        <article className="metric-card"><span>Contacts</span><strong>{contacts ?? 0}</strong><small>Customers & suppliers</small></article>
        <article className="metric-card"><span>Accounts</span><strong>{accounts ?? 0}</strong><small>Chart of accounts</small></article>
        <article className="metric-card"><span>Posting</span><strong>RPC</strong><small>Transactional database boundary</small></article>
      </section>

      <section className="section-heading">
        <div><h2>Modules</h2><p>Core ERP workflows backed by the fixed database contract.</p></div>
      </section>

      <section className="module-grid">
        {modules.map((module) => (
          <Link className="module-card" href={module.href} key={module.title}>
            <div>
              <span className="module-dot" />
              <h3>{module.title}</h3>
              <p>{module.description}</p>
            </div>
            <span className="module-action">{module.action} →</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
