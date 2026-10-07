import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getSale } from "@/lib/sales/queries";
import { SaleDetail } from "@/components/sales/sale-detail";

export default async function SaleDetailPage({params}:{params:Promise<{id:string}>}){const context=await getApplicationContext();if(!context.activeOrganization)return null;try{return <SaleDetail sale={await getSale(await createClient(),context.activeOrganization.id,(await params).id)}/>;}catch(error){notFound();}}