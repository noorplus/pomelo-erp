import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";
export async function listContacts(s:TypedSupabaseClient,org:string){const{data,error}=await s.from("contacts").select("*").eq("organization_id",org).order("name");if(error)throwSupabaseError(error,"DATABASE_ERROR","Unable to load contacts.");return data;}
export async function getContact(s:TypedSupabaseClient,org:string,id:string){const{data,error}=await s.from("contacts").select("*").eq("organization_id",org).eq("id",id).maybeSingle();if(error)throwSupabaseError(error,"DATABASE_ERROR","Unable to load the contact.");return data;}
export async function getContactActivity(s:TypedSupabaseClient,org:string,contactId:string){const[sales,purchases,salesReturns,purchaseReturns,payments,expenses]=await Promise.all([
s.from("sales").select("id,invoice_id,invoice_date,total_amount,status").eq("organization_id",org).eq("customer_id",contactId).order("invoice_date",{ascending:false}),
s.from("purchase").select("id,invoice_id,invoice_date,total_amount,status").eq("organization_id",org).eq("supplier_id",contactId).order("invoice_date",{ascending:false}),
s.from("sales_returns").select("id,return_number,return_date,total_amount,status").eq("organization_id",org).eq("customer_id",contactId).order("return_date",{ascending:false}),
s.from("purchase_returns").select("id,return_number,return_date,total_amount,status").eq("organization_id",org).eq("supplier_id",contactId).order("return_date",{ascending:false}),
s.from("payments").select("id,payment_number,payment_date,amount,payment_type,status,description").eq("organization_id",org).eq("contact_id",contactId).order("payment_date",{ascending:false}),
s.from("expenses").select("id,expense_number,expense_date,amount,status,description").eq("organization_id",org).eq("contact_id",contactId).order("expense_date",{ascending:false})]);
for(const r of[sales,purchases,salesReturns,purchaseReturns,payments,expenses])if(r.error)throwSupabaseError(r.error,"DATABASE_ERROR","Unable to load contact activity.");
return{sales:sales.data??[],purchases:purchases.data??[],salesReturns:salesReturns.data??[],purchaseReturns:purchaseReturns.data??[],payments:payments.data??[],expenses:expenses.data??[]};}
