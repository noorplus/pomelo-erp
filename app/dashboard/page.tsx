import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LegacyDashboardRedirect() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  redirect("/dashboard");
}