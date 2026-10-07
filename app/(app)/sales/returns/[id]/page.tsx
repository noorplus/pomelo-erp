import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getSalesReturn } from "@/lib/sales/queries";
import { ReturnDetail } from "@/components/sales/return-detail";

export default async function SalesReturnDetailPage({params}:{params:Promise<{id:string}>}){const context=await getApplicationContext();if(!context.activeOrganization)return null;try{return <ReturnDetail item={await getSalesReturn(await createClient(),context.activeOrganization.id,(await params).id)}/>;}catch(error){notFound();}}