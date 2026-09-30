"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const authError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setPending(false);
      return;
    }

    window.location.assign(next);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">P</div>
        <p className="eyebrow">Pomelo ERP</p>
        <h1>Sign in</h1>
        <p className="auth-copy">Access your inventory, sales, purchasing, and accounting workspace.</p>

        <form onSubmit={handleSubmit} className="form-stack">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {authError === "invalid_confirmation" ? <p className="form-error" role="alert">The email confirmation link is invalid or incomplete.</p> : null}
          {authError === "confirmation_failed" ? <p className="form-error" role="alert">The email confirmation link has expired or is no longer valid.</p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-shell"><section className="auth-card"><div className="brand-mark">P</div><p className="eyebrow">Pomelo ERP</p><h1>Sign in</h1><p className="auth-copy">Loading sign-in…</p></section></main>}>
      <LoginPageContent />
    </Suspense>
  );
}
