import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database";
type ProductInput = Pick<TablesInsert<"products">, "name" | "unit_id" | "inventory_account_id" | "sales_account_id" | "cogs_account_id" | "is_active">;
export async function createProduct(s: TypedSupabaseClient, org: string, input: ProductInput) {
  const { data, error } = await s.from("products").insert({ organization_id: org, product_code: null, ...input }).select("id,product_code").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the product.");
  return data;
}
export async function updateProduct(s: TypedSupabaseClient, org: string, id: string, input: ProductInput) {
  const update: TablesUpdate<"products"> = input;
  const { error } = await s.from("products").update(update).eq("organization_id", org).eq("id", id);
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to update the product.");
}
