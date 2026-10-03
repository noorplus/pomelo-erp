"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const normalizedFullName = fullName.trim();
    const normalizedPhone = phone.trim();
    const normalizedEmail = email.trim();

    if (!normalizedFullName || !normalizedEmail || !password || !confirmPassword) {
      setError("Complete all required fields.");
      return;
    }
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
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/auth/confirm",
        data: { full_name: normalizedFullName, phone: normalizedPhone || null },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setPending(false);
      return;
    }

    if (data.session) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setError("Account was created, but the user session could not be initialized. Please sign in.");
        setPending(false);
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({ id: userData.user.id, full_name: normalizedFullName, phone: normalizedPhone || null }, { onConflict: "id" });

      if (profileError) {
        await supabase.auth.signOut();
        setError("Account was created, but your profile could not be initialized. Please try signing in again.");
        setPending(false);
        return;
      }

      window.location.assign("/");
      return;
    }

    setSent(true);
    setPending(false);
  }

  if (sent) {
    return (
      <main className="auth-shell">
        <div className="auth-layout auth-layout-centered">
          <section className="auth-intro auth-intro-compact">
            <div className="auth-brand"><span className="brand-mark">P</span><strong>Pomelo ERP</strong></div>
            <div className="auth-intro-copy"><p className="auth-kicker">One more step</p><h1>Confirm your email to activate your workspace.</h1><p>Your account is created. Confirm the email address before signing in.</p></div>
          </section>
          <section className="auth-panel" aria-labelledby="confirmation-title">
            <div className="success-icon" aria-hidden="true">✓</div>
            <div className="auth-panel-header">
              <p className="eyebrow">Check your inbox</p>
              <h2 id="confirmation-title">Confirm your email</h2>
              <p>We sent a confirmation link to <strong>{email}</strong>.</p>
            </div>
            <div className="auth-info-box"><strong>What happens next?</strong><span>Open the link in the email. After confirmation, you can sign in and create your Pomelo ERP organization.</span></div>
            <Link className="auth-secondary" href="/login">Back to sign in</Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <div className="auth-layout">
        <section className="auth-intro">
          <div className="auth-brand"><span className="brand-mark">P</span><strong>Pomelo ERP</strong></div>
          <div className="auth-intro-copy">
            <p className="auth-kicker">Start your ERP workspace</p>
            <h1>Create an account and set up your organization.</h1>
            <p>Use a business email you can access. Your organization is configured after email confirmation.</p>
          </div>
          <div className="auth-feature-list"><span>Secure authentication</span><span>Organization-based workspace</span><span>Built for daily operations</span></div>
        </section>

        <section className="auth-panel" aria-labelledby="signup-title">
          <div className="auth-mobile-brand"><span className="brand-mark">P</span></div>
          <div className="auth-panel-header">
            <p className="eyebrow">Get started</p>
            <h2 id="signup-title">Create your account</h2>
            <p>Set up your secure Pomelo ERP sign-in.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field">
              <span>Full name</span>
              <input className="auth-input" type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" autoFocus required maxLength={160} placeholder="Your full name" />
            </label>

            <label className="auth-field">
              <span>Phone</span>
              <input className="auth-input" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" maxLength={40} placeholder="+880..." />
            </label>

            <label className="auth-field">
              <span>Email</span>
              <input className="auth-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@company.com" />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <span className="password-input-wrap">
                <input className="auth-input" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required placeholder="At least 8 characters" />
                <button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
              </span>
            </label>

            <label className="auth-field">
              <span>Confirm password</span>
              <span className="password-input-wrap">
                <input className="auth-input" type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required placeholder="Repeat your password" />
                <button className="password-toggle" type="button" onClick={() => setShowConfirm((value) => !value)} aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}>{showConfirm ? "Hide" : "Show"}</button>
              </span>
            </label>

            <p className="password-hint"><span className={password.length >= 8 ? "valid" : ""}>●</span> At least 8 characters</p>
            {error ? <p className="auth-message error" role="alert">{error}</p> : null}

            <button className="auth-primary" type="submit" disabled={pending}>
              {pending ? <><span className="auth-spinner" aria-hidden="true" />Creating account…</> : "Create account"}
            </button>
          </form>

          <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
        </section>
      </div>
    </main>
  );
}
