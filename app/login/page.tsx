"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const authError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setPending(false);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError("Signed in, but the user session could not be initialized. Please try again.");
      setPending(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userData.user.id }, { onConflict: "id" });

    if (profileError) {
      await supabase.auth.signOut();
      setError("Signed in, but your profile could not be initialized. Please try again.");
      setPending(false);
      return;
    }

    window.location.assign(next);
  }

  return (
    <main className="auth-shell">
      <div className="auth-layout">
        <section className="auth-intro">
          <div className="auth-brand"><span className="brand-mark">P</span><strong>Pomelo ERP</strong></div>
          <div className="auth-intro-copy">
            <p className="auth-kicker">Business operations, in one workspace</p>
            <h1>Run your inventory, sales, purchasing and accounting with confidence.</h1>
            <p>Sign in to continue to your organization workspace.</p>
          </div>
          <div className="auth-feature-list" aria-label="Pomelo ERP features">
            <span>Inventory control</span><span>Double-entry accounting</span><span>Operational reporting</span>
          </div>
        </section>

        <section className="auth-panel" aria-labelledby="login-title">
          <div className="auth-panel-header">
            <div className="auth-mobile-brand"><span className="brand-mark">P</span></div>
            <p className="eyebrow">Welcome back</p>
            <h2 id="login-title">Sign in to Pomelo</h2>
            <p>Use your organization account to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field">
              <span>Email</span>
              <input className="auth-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoFocus required placeholder="you@company.com" />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <span className="password-input-wrap">
                <input className="auth-input" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required placeholder="Enter your password" />
                <button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
              </span>
            </label>

            {authError === "invalid_confirmation" ? <p className="auth-message error" role="alert">That confirmation link is invalid or incomplete. Request a new confirmation email or sign in.</p> : null}
            {authError === "confirmation_failed" ? <p className="auth-message error" role="alert">That confirmation link has expired or is no longer valid. Please try again.</p> : null}
            {authError === "profile_setup_failed" ? <p className="auth-message error" role="alert">Email confirmed, but your profile could not be initialized. Please sign in again.</p> : null}
            {error ? <p className="auth-message error" role="alert">{error}</p> : null}

            <button className="auth-primary" type="submit" disabled={pending}>
              {pending ? <><span className="auth-spinner" aria-hidden="true" />Signing in…</> : "Sign in"}
            </button>
          </form>

          <p className="auth-switch">Don&apos;t have an account? <Link href="/signup">Create one</Link></p>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-shell"><section className="auth-panel auth-loading"><span className="brand-mark">P</span><p>Loading sign in…</p></section></main>}>
      <LoginPageContent />
    </Suspense>
  );
}
