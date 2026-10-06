import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";

export type TypedSupabaseClient = SupabaseClient<Database>;
