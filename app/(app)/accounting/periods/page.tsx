import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { listAccountingPeriods } from "@/lib/accounting/queries";
import { AccountingPeriods } from "@/components/accounting/accounting-periods";

export default async function AccountingPeriodsPage() {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;
  const supabase = await createClient();
  const periods = await listAccountingPeriods(supabase, context.activeOrganization.id);
  return <AccountingPeriods organizationId={context.activeOrganization.id} periods={periods} />;
}
