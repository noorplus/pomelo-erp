import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { listUnits, listProducts, listActiveAccounts, listNumberSequences } from "@/lib/master-data/queries";
import { MasterData } from "@/components/master-data/master-data";

export default async function MasterDataPage() {
  const c = await getApplicationContext();
  if (!c.activeOrganization) return null;
  const s = await createClient();
  const [units, products, accounts, numberSequences] = await Promise.all([
    listUnits(s, c.activeOrganization.id),
    listProducts(s, c.activeOrganization.id),
    listActiveAccounts(s, c.activeOrganization.id),
    listNumberSequences(s, c.activeOrganization.id),
  ]);
  return <MasterData org={c.activeOrganization.id} units={units} products={products} accounts={accounts} numberSequences={numberSequences} />;
}
