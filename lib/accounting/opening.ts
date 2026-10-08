import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";

export async function postOpeningSetup(s: TypedSupabaseClient, input:{
 organizationId:string; openingDate:string; description:string;
 journalLines:Array<{account_id:string;debit:number;credit:number;description?:string}>;
 stockLines:Array<{product_id:string;quantity:number;unit_cost:number}>;
}) {
 const {data,error}=await s.rpc("post_opening_setup",{
  p_organization_id:input.organizationId,p_opening_date:input.openingDate,p_description:input.description,
  p_journal_lines:input.journalLines,p_stock_lines:input.stockLines
 } as never);
 if(error) throwSupabaseError(error,"RPC_ERROR","Unable to initialize opening balances and opening stock.");
 return data;
}