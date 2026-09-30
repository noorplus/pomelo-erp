import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

  if (!tokenHash || type !== "email") {
    return NextResponse.redirect(new URL("/login?error=invalid_confirmation", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
