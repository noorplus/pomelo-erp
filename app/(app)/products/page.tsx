import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { listProducts } from "@/lib/products/queries";
import { Products } from "@/components/products/products";

export default async function ProductsPage() {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;
  const products = await listProducts(await createClient(), context.activeOrganization.id);
  return <Products rows={products} />;
}
