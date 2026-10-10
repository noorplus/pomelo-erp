import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getSalesFormOptions } from "@/lib/sales/queries";
import { SalesForm } from "@/components/sales/sales-form";

export default async function NewSalesPage(){const context=await getApplicationContext();if(!context.activeOrganization)return null;const options=await getSalesFormOptions(await createClient(),context.activeOrganization.id);return <SalesForm org={context.activeOrganization.id} userId={context.user.id} currency={context.activeOrganization.base_currency} {...options}/>;}