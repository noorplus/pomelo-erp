"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findCurrentOrganization } from "@/lib/supabase/organization";

export type OnboardingState = { error?: string };

const ALLOWED_CURRENCIES = new Set(["BDT", "USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD"]);
const ALLOWED_TIMEZONES = new Set([
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Dubai",
  "Europe/London",
  "UTC",
]);

export async function createOrganization(
  _previousState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const baseCurrency = String(formData.get("base_currency") ?? "BDT").trim().toUpperCase();
  const timezone = String(formData.get("timezone") ?? "Asia/Dhaka").trim();
  const taxNumber = String(formData.get("tax_number") ?? "").trim();

  if (!name) return { error: "Organization name is required." };
  if (name.length > 160) return { error: "Organization name is too long." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid organization email." };
  if (!country) return { error: "Country is required." };
  if (!ALLOWED_CURRENCIES.has(baseCurrency)) return { error: "Select a supported base currency." };
  if (!ALLOWED_TIMEZONES.has(timezone)) return { error: "Select a supported timezone." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Your session has expired. Please sign in again." };

  const existingOrganization = await findCurrentOrganization();
  if (existingOrganization) redirect("/");

  const organizationId = crypto.randomUUID();

  const { error } = await supabase.from("organizations").insert({
    id: organizationId,
    name,
    phone: phone || null,
    email: email || null,
    address: address || null,
    city: city || null,
    country,
    base_currency: baseCurrency,
    timezone,
    tax_number: taxNumber || null,
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

  redirect("/");
}
