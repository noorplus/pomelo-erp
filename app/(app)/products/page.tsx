import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { listProducts, listProductUnits } from "@/lib/products/queries";
import { Products } from "@/components/products/products";

export default async function ProductsPage() {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;
  const client = await createClient();
  const [products, units] = await Promise.all([
    listProducts(client, context.activeOrganization.id),
    listProductUnits(client, context.activeOrganization.id),
  ]);
  return <Products org={context.activeOrganization.id} rows={products} units={units} />;
}
