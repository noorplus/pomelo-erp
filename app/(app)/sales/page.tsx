import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getSalesDashboard } from "@/lib/sales/queries";
import { SalesDashboard } from "@/components/sales/sales-dashboard";

export default async function SalesPage(){const context=await getApplicationContext();if(!context.activeOrganization)return null;const data=await getSalesDashboard(await createClient(),context.activeOrganization.id);return <SalesDashboard data={data} currency={context.activeOrganization.base_currency}/>;}