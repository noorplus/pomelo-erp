import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getFinancialReportData } from "@/lib/accounting/queries";
import { FinancialReport } from "@/components/accounting/financial-report";

export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const c = await getApplicationContext();
  if (!c.activeOrganization) return null;
  const p = await searchParams;
  const data = await getFinancialReportData(await createClient(), c.activeOrganization.id, { periodId: p.period, from: p.from, to: p.to });
  return <FinancialReport title="Balance Sheet" description="Posted asset, liability and equity balances." rows={data.rows} filter={(r) => r.account_type === "ASSET" || r.account_type === "LIABILITY" || r.account_type === "EQUITY"} periods={data.periods} from={data.filters.from} to={data.filters.to} periodId={data.filters.periodId} variant="balance-sheet" currency={c.activeOrganization.base_currency} />;
}
