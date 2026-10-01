import Link from "next/link";
import { notFound } from "next/navigation";
import { ErpPageShell } from "@/components/erp-page-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";

const modules: Record<string, { title: string; description: string; configuration?: { href: string; label: string; description: string }[] }> = {
  sales: { title: "Sales", description: "Sales module will be completed from the existing sales and accounting database model." },
  purchases: { title: "Purchases", description: "Purchases module will be completed from the existing purchase and accounting database model." },
  inventory: { title: "Inventory", description: "Inventory module will be completed from the existing inventory ledger and valuation database model.", configuration: [{ href: "/inventory/configuration/units", label: "Units of Measure", description: "Reusable units assigned to products." }] },
  accounting: { title: "Accounting", description: "Accounting module will be completed from the existing journal, ledger, and period database model.", configuration: [
    { href: "/accounting/configuration/accounts", label: "Chart of Accounts", description: "Accounts and posting configuration." },
    { href: "/accounting/configuration/periods", label: "Accounting Periods", description: "Open and close posting periods." },
    { href: "/accounting/configuration/sequences", label: "Number Sequences", description: "Automatic document numbering." },
  ] },
  payments: { title: "Payments", description: "Payments module will be completed from the existing payments and allocation database model." },
  expenses: { title: "Expenses", description: "Expenses module will be completed from the existing expense and accounting database model.", configuration: [{ href: "/expenses/configuration/categories", label: "Expense Categories", description: "Classify expenses and map them to accounts." }] },
  reports: { title: "Reports", description: "Reports module will be completed from the existing ERP database model." },
};

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const item = modules[module];
  if (!item) notFound();

  return (
    <ErpPageShell>
      <ModulePlaceholder title={item.title} description={item.description} />
      {item.configuration && (
        <section className="module-config-links">
          <div className="section-heading"><div><h2>Configuration</h2><p>Settings owned by the {item.title.toLowerCase()} module.</p></div></div>
          <div className="module-grid">
            {item.configuration.map(config => (
              <Link className="module-card settings-link-card" href={config.href} key={config.href}>
                <div><span className="module-dot" /><h3>{config.label}</h3><p>{config.description}</p></div>
                <span className="module-action">Open configuration →</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </ErpPageShell>
  );
}
