import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";
import type { Tables } from "@/lib/supabase/database";

export async function listNumberSequences(s: TypedSupabaseClient, org: string): Promise<Tables<"number_sequences">[]> {
  const { data, error } = await s.from("number_sequences").select("*").eq("organization_id", org).order("document_type");
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load document numbering sequences.");
  return data;
}
