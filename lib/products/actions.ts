import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database";

export async function createProduct(s: TypedSupabaseClient, org: string, input: Omit<TablesInsert<"products">, "organization_id">) {
  const { data, error } = await s.from("products").insert({ ...input, organization_id: org }).select("id,product_code").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the product.");
  return data;
}

export async function updateProduct(s: TypedSupabaseClient, org: string, id: string, input: TablesUpdate<"products">) {
  const { error } = await s.from("products").update({ ...input, organization_id: undefined }).eq("organization_id", org).eq("id", id);
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to update the product.");
}
