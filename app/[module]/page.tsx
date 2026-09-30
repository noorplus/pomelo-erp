import Link from "next/link";
import { notFound } from "next/navigation";

const modules: Record<string, { title: string; description: string; next: string }> = {
  products: { title: "Products", description: "Manage the product master, units, pricing, and inventory account mappings.", next: "Product management UI is the next build slice." },
  sales: { title: "Sales", description: "Create and manage sales invoices, returns, receivables, and customer transactions.", next: "Sales workflow UI is the next build slice." },
  purchases: { title: "Purchases", description: "Manage supplier invoices, purchase returns, payables, and procurement workflows.", next: "Purchasing workflow UI is the next build slice." },
  inventory: { title: "Inventory", description: "Monitor stock balances, movements, and inventory valuation.", next: "Inventory workflow UI is the next build slice." },
  accounting: { title: "Accounting", description: "Work with journals, ledger activity, accounting periods, and financial controls.", next: "Accounting workspace UI is the next build slice." },
  payments: { title: "Payments", description: "Manage receipts, supplier payments, allocations, and refunds.", next: "Payment workflow UI is the next build slice." },
  expenses: { title: "Expenses", description: "Capture and post operating expenses against the existing accounting model.", next: "Expense workflow UI is the next build slice." },
  reports: { title: "Reports", description: "Financial, inventory, sales, purchasing, receivable, and payable reporting.", next: "Reporting workspace UI is the next build slice." },
};

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const item = modules[module];
  if (!item) notFound();

  return (
    <section className="module-workspace">
      <Link href="/" className="back-link">← Overview</Link>
      <div className="workspace-card">
        <p className="eyebrow">ERP module</p>
        <h1>{item.title}</h1>
        <p>{item.description}</p>
        <div className="workspace-note">
          <strong>Foundation ready</strong>
          <span>{item.next}</span>
        </div>
      </div>
    </section>
  );
}
