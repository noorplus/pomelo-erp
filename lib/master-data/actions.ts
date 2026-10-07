import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database";

export async function createUnit(s: TypedSupabaseClient, org: string, name: string) {
  const { data, error } = await s.from("units_of_measure").insert({ organization_id: org, name }).select("id").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the unit.");
  return data.id;
}
export async function updateUnit(s: TypedSupabaseClient, org: string, id: string, input: TablesUpdate<"units_of_measure">) {
  const { error } = await s.from("units_of_measure").update({ ...input, organization_id: undefined }).eq("organization_id", org).eq("id", id);
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to update the unit.");
}
export async function createContact(s: TypedSupabaseClient, org: string, input: Omit<TablesInsert<"contacts">, "organization_id">) {
  const { data, error } = await s.from("contacts").insert({ ...input, organization_id: org }).select("id").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the contact.");
  return data.id;
}
export async function updateContact(s: TypedSupabaseClient, org: string, id: string, input: TablesUpdate<"contacts">) {
  const { error } = await s.from("contacts").update({ ...input, organization_id: undefined }).eq("organization_id", org).eq("id", id);
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to update the contact.");
}
export async function createProduct(s: TypedSupabaseClient, org: string, input: Omit<TablesInsert<"products">, "organization_id">) {
  const { data, error } = await s.from("products").insert({ ...input, organization_id: org }).select("id").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the product.");
  return data.id;
}
export async function updateProduct(s: TypedSupabaseClient, org: string, id: string, input: TablesUpdate<"products">) {
  const { error } = await s.from("products").update({ ...input, organization_id: undefined }).eq("organization_id", org).eq("id", id);
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to update the product.");
}
