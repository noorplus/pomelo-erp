import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { listSales } from "@/lib/sales/queries";
import { SalesList } from "@/components/sales/sales-list";

export default async function SalesInvoicesPage(){const context=await getApplicationContext();if(!context.activeOrganization)return null;const rows=await listSales(await createClient(),context.activeOrganization.id);return <SalesList rows={rows} currency={context.activeOrganization.base_currency}/>;}