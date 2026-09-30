"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin + "/auth/confirm",
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setPending(false);
      return;
    }

    if (data.session) {
      window.location.assign("/dashboard");
      return;
    }

    setSent(true);
    setPending(false);
  }

  if (sent) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-mark">P</div>
          <p className="eyebrow">Pomelo ERP</p>
          <h1>Check your email</h1>
          <p className="auth-copy">
            We sent a confirmation link to <strong>{email}</strong>. Confirm your email address, then return here to sign in.
          </p>
          <Link className="secondary-button auth-link-button" href="/login">Back to sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">P</div>
        <p className="eyebrow">Pomelo ERP</p>
        <h1>Create account</h1>
        <p className="auth-copy">
          Create a real Supabase Auth account. No demo users or mock credentials are used.
        </p>
        <form onSubmit={handleSubmit} className="form-stack">
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
          </label>
          <label>
            Confirm password
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="auth-footer">Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
