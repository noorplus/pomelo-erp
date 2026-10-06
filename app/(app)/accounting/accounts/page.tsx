import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { listAccounts } from "@/lib/accounting/queries";
import { ChartOfAccounts } from "@/components/accounting/chart-of-accounts";

export default async function ChartOfAccountsPage() {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;
  const supabase = await createClient();
  const accounts = await listAccounts(supabase, context.activeOrganization.id);
  return <ChartOfAccounts organizationId={context.activeOrganization.id} accounts={accounts} />;
}
