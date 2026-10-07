import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { listProductFormOptions } from "@/lib/products/queries";
import { NewProduct } from "@/components/products/new-product";

export default async function NewProductPage() {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;
  const options = await listProductFormOptions(await createClient(), context.activeOrganization.id);
  return <NewProduct org={context.activeOrganization.id} units={options.units} accounts={options.accounts} />;
}
