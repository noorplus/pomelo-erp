import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getSalesReturnFormOptions } from "@/lib/sales/queries";
import { ReturnForm } from "@/components/sales/return-form";

export default async function NewSalesReturnPage(){const context=await getApplicationContext();if(!context.activeOrganization)return null;const options=await getSalesReturnFormOptions(await createClient(),context.activeOrganization.id);return <ReturnForm org={context.activeOrganization.id} userId={context.user.id} {...options}/>;}