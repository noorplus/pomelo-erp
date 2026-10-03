"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import type { ActionState } from "@/lib/erp/types";

const s=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const n=(fd:FormData,k:string)=>Number(fd.get(k)??0);
const dbError=(e:{code?:string;message?:string})=>{
  if(e.code==="42501") return "You do not have permission for this operation.";
  if(e.code==="23503") return "The selected record is invalid.";
  if(e.code==="23514") return e.message||"A database business rule was not satisfied.";
  return e.message||"The operation failed.";
};

export async function postInventoryAdjustment(fd:FormData):Promise<ActionState>{
  try{
    const supabase:any=await createClient();
    const org=await getCurrentOrganization();
    if(!["owner","admin","manager"].includes(org.role)) return {error:"Only owner, admin or manager can post inventory adjustments."};
    const productId=s(fd,"product_id"), date=s(fd,"transaction_date"), direction=s(fd,"direction");
    const quantity=n(fd,"quantity"), unitCost=n(fd,"unit_cost");
    const offset=s(fd,"offset_account_id"), description=s(fd,"description")||null;
    if(!productId||!date||!["in","out"].includes(direction)||quantity<=0) return {error:"Product, date, direction and a positive quantity are required."};
    if(direction==="in" && unitCost<0) return {error:"Unit cost cannot be negative."};
    if(!offset) return {error:"An offset account is required."};
    const {error}=await supabase.rpc("post_inventory_adjustment",{
      p_org_id:org.id,p_product_id:productId,p_transaction_date:date,
      p_transaction_type:"adjustment",p_direction:direction,p_quantity:quantity,
      p_unit_cost:direction==="in"?unitCost:null,p_offset_account_id:offset,
      p_reference_id:randomUUID(),p_description:description
    });
    if(error) return {error:dbError(error)};
    revalidatePath("/inventory"); revalidatePath("/accounting"); revalidatePath("/reports"); revalidatePath("/");
    return {success:"Inventory adjustment posted successfully."};
  }catch(e){return {error:e instanceof Error?e.message:"The operation failed."};}
}
