import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader, PageSection, StatusBadge } from "@/components/ui";
import type { Tables } from "@/lib/supabase/database";

type Product = Tables<"products">;
type Unit = { id: string; name: string; is_active: boolean } | null;
type Account = { id: string; account_code: string; account_name: string; account_type: string; is_postable: boolean; is_active: boolean } | null;
type Inventory = Tables<"inventory_balances"> | null;

export function ProductDetail({ product, unit, inventory, inventoryAccount, salesAccount, cogsAccount }: {
  product: Product;
  unit: Unit;
  inventory: Inventory;
  inventoryAccount: Account;
  salesAccount: Account;
  cogsAccount: Account;
}) {
  return (
    <div className="page products-detail-page">
      <PageHeader eyebrow="Products" title={product.name} description={product.product_code ?? "Product details"} actions={<><Link className="button" href="/products"><ArrowLeft size={16} /> Products</Link><Link className="button primary" href={`/products/new?id=${product.id}`}><Pencil size={16} /> Edit</Link></>} />
      <PageSection title="Product details" actions={<StatusBadge tone={product.is_active ? "success" : "neutral"}>{product.is_active ? "Active" : "Inactive"}</StatusBadge>}>
        <div className="ui-detail-grid">
          <div><span>Product code</span><strong>{product.product_code ?? "—"}</strong></div>
          <div><span>Name</span><strong>{product.name}</strong></div>
          <div><span>Unit</span><strong>{unit?.name ?? "—"}</strong></div>
          <div><span>Inventory quantity</span><strong>{inventory?.quantity ?? 0}</strong></div>
          <div><span>Average cost</span><strong>{inventory?.average_cost ?? 0}</strong></div>
          <div><span>Inventory value</span><strong>{inventory?.inventory_value ?? 0}</strong></div>
        </div>
      </PageSection>
      <PageSection title="Accounting configuration">
        <div className="ui-detail-grid">
          <div><span>Inventory account</span><strong>{inventoryAccount ? `${inventoryAccount.account_code} — ${inventoryAccount.account_name}` : "—"}</strong></div>
          <div><span>Sales account</span><strong>{salesAccount ? `${salesAccount.account_code} — ${salesAccount.account_name}` : "—"}</strong></div>
          <div><span>COGS account</span><strong>{cogsAccount ? `${cogsAccount.account_code} — ${cogsAccount.account_name}` : "—"}</strong></div>
        </div>
      </PageSection>
    </div>
  );
}
