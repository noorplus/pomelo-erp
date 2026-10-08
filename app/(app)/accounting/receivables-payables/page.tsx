import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getFinancialReportData } from "@/lib/accounting/queries";
import { FinancialReport } from "@/components/accounting/financial-report";

export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const c = await getApplicationContext();
  if (!c.activeOrganization) return null;
  const p = await searchParams;
  const data = await getFinancialReportData(await createClient(), c.activeOrganization.id, { periodId: p.period, from: p.from, to: p.to });
  return <FinancialReport title="Receivables & Payables" description="All active control accounts classified as assets or liabilities." rows={data.rows} filter={(r) => r.is_control_account && (r.account_type === "ASSET" || r.account_type === "LIABILITY")} periods={data.periods} from={data.filters.from} to={data.filters.to} periodId={data.filters.periodId} variant="receivables-payables" />;
}
