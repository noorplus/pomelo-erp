import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (tokenHash && type === "email") {
    const { error } = await supabase.auth.verifyOtp({
      type: "email",
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=invalid_confirmation", request.url));
}
