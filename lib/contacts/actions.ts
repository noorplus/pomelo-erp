import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database";

type ContactInput = Pick<
  TablesInsert<"contacts">,
  "name" | "phone" | "email" | "address" | "is_active"
>;

export async function createContact(
  s: TypedSupabaseClient,
  org: string,
  userId: string,
  input: ContactInput,
) {
  const { data, error } = await s
    .from("contacts")
    .insert({
      organization_id: org,
      created_by: userId,
      ...input,
    })
    .select("id")
    .single();

  if (error) {
    throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the contact.");
  }

  return data.id;
}

export async function updateContact(
  s: TypedSupabaseClient,
  org: string,
  id: string,
  input: Pick<
    TablesUpdate<"contacts">,
    "name" | "phone" | "email" | "address" | "is_active"
  >,
) {
  const { error } = await s
    .from("contacts")
    .update(input)
    .eq("organization_id", org)
    .eq("id", id);

  if (error) {
    throwSupabaseError(error, "DATABASE_ERROR", "Unable to update the contact.");
  }
}
