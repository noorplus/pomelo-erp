"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findCurrentOrganization } from "@/lib/supabase/organization";

export type OnboardingState = { error?: string };

export async function createOrganization(
  _previousState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim();
  const legalName = String(formData.get("legal_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();

  if (!name) return { error: "Organization name is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Your session has expired. Please sign in again." };

  const existingOrganization = await findCurrentOrganization();
  if (existingOrganization) redirect("/dashboard");

  const organizationId = crypto.randomUUID();

  const { error } = await supabase.from("organizations").insert({
    id: organizationId,
    name,
    legal_name: legalName || null,
    phone: phone || null,
    email: email || null,
    address: address || null,
    city: city || null,
    country: "Bangladesh",
    base_currency: "BDT",
    timezone: "Asia/Dhaka",
  });

  if (error) {
    return { error: error.message || "Unable to create the organization." };
  }

  const cookieStore = await cookies();
  cookieStore.set("pomelo_org_id", organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}
