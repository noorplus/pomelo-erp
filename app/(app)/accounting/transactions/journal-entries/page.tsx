import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { listAccountingOptions, listJournalEntries } from "@/lib/accounting/queries";
import { AccountingTransactions } from "@/components/accounting/accounting-transactions";
export default async function Page(){const c=await getApplicationContext();if(!c.activeOrganization)return null;const s=await createClient();const [rows,o]=await Promise.all([listJournalEntries(s,c.activeOrganization.id),listAccountingOptions(s,c.activeOrganization.id)]);return <AccountingTransactions mode="journal" organizationId={c.activeOrganization.id} rows={rows} {...o}/>;}