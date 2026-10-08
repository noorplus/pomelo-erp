import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { listAccountingOptions, listPayments } from "@/lib/accounting/queries";
import { AccountingTransactions } from "@/components/accounting/accounting-transactions";
export default async function Page(){const c=await getApplicationContext();if(!c.activeOrganization)return null;const s=await createClient();const [rows,o]=await Promise.all([listPayments(s,c.activeOrganization.id),listAccountingOptions(s,c.activeOrganization.id)]);return <AccountingTransactions mode="payments" organizationId={c.activeOrganization.id} rows={rows} {...o}/>;}