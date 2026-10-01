import { notFound } from "next/navigation";
import { ErpPageShell } from "@/components/erp-page-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";

const modules: Record<string, { title: string; description: string }> = {
  sales: { title: "Sales", description: "Sales module will be completed from the existing sales and accounting database model." },
  purchases: { title: "Purchases", description: "Purchases module will be completed from the existing purchase and accounting database model." },
  inventory: { title: "Inventory", description: "Inventory module will be completed from the existing inventory ledger and valuation database model." },
  accounting: { title: "Accounting", description: "Accounting module will be completed from the existing journal, ledger, and period database model." },
  payments: { title: "Payments", description: "Payments module will be completed from the existing payments and allocation database model." },
  expenses: { title: "Expenses", description: "Expenses module will be completed from the existing expense and accounting database model." },
  reports: { title: "Reports", description: "Reports module will be completed from the existing ERP database model." },
};

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const item = modules[module];
  if (!item) notFound();

  return (
    <ErpPageShell>
      <ModulePlaceholder title={item.title} description={item.description} />
    </ErpPageShell>
  );
}
