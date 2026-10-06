"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) setError(signInError.message);
    else window.location.assign("/dashboard");

    setPending(false);
  }

  return (
    <main className="shell">
      <section className="hero" style={{ maxWidth: 520 }}>
        <p className="eyebrow">Pomelo ERP</p>
        <h1 style={{ fontSize: "clamp(2.25rem, 7vw, 3.5rem)" }}>Sign in</h1>
        <form onSubmit={handleSubmit} style={{ marginTop: 32, display: "grid", gap: 16 }}>
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={{ width: "100%", marginTop: 8, padding: 12 }}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ width: "100%", marginTop: 8, padding: 12 }}
            />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <button className="button primary" disabled={pending} type="submit">
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}