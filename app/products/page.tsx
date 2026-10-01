import { ErpPageShell } from "@/components/erp-page-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function ProductsPage() {
  return (
    <ErpPageShell>
      <ModulePlaceholder title="Products" description="Product master will be completed from the existing products, units, accounts, and inventory database model." />
    </ErpPageShell>
  );
}
