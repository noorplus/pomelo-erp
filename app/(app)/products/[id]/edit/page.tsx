import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getProduct, listProductFormOptions } from "@/lib/products/queries";
import { NewProduct } from "@/components/products/new-product";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;
  const s = await createClient();
  const [product, options] = await Promise.all([
    getProduct(s, context.activeOrganization.id, (await params).id),
    listProductFormOptions(s, context.activeOrganization.id),
  ]);
  if (!product) notFound();
  return <NewProduct org={context.activeOrganization.id} units={options.units} accounts={options.accounts} product={product} />;
}
