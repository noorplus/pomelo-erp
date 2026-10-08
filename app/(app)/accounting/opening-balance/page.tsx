import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getOpeningBalanceState } from "@/lib/accounting/queries";
import { OpeningBalance } from "@/components/accounting/opening-balance";

export default async function Page() {
  const c = await getApplicationContext();
  if (!c.activeOrganization) return null;
  const state = await getOpeningBalanceState(await createClient(), c.activeOrganization.id);
  return <OpeningBalance organizationId={c.activeOrganization.id} {...state} />;
}
