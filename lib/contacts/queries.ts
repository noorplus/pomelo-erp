import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";

export async function listContacts(s: TypedSupabaseClient, org: string) {
  const { data, error } = await s
    .from("contacts")
    .select("*")
    .eq("organization_id", org)
    .order("name");

  if (error) {
    throwSupabaseError(error, "DATABASE_ERROR", "Unable to load contacts.");
  }

  return data;
}

export async function getContact(
  s: TypedSupabaseClient,
  org: string,
  id: string,
) {
  const { data, error } = await s
    .from("contacts")
    .select("*")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throwSupabaseError(error, "DATABASE_ERROR", "Unable to load the contact.");
  }

  return data;
}
