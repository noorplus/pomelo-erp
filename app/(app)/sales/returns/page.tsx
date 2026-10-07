import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { listSalesReturns } from "@/lib/sales/queries";
import { ReturnsList } from "@/components/sales/returns-list";

export default async function SalesReturnsPage(){const context=await getApplicationContext();if(!context.activeOrganization)return null;const rows=await listSalesReturns(await createClient(),context.activeOrganization.id);return <ReturnsList rows={rows}/>;}