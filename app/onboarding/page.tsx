"use client";

import { useActionState } from "react";
import { createOrganization } from "./actions";

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(createOrganization, {});

  return (
    <main className="auth-shell">
      <section className="auth-card onboarding-card">
        <div className="brand-mark">P</div>
        <p className="eyebrow">First-time setup</p>
        <h1>Create your organization</h1>
        <p className="auth-copy">
          Set up the ERP workspace. Your account will become the organization owner automatically.
        </p>

        <form action={formAction} className="form-stack">
          <label>
            Organization name
            <input name="name" required placeholder="Your company name" />
          </label>

          <label>
            Legal name
            <input name="legal_name" placeholder="Optional legal name" />
          </label>

          <label>
            Phone
            <input name="phone" placeholder="+880..." />
          </label>

          <label>
            Email
            <input name="email" type="email" placeholder="company@example.com" />
          </label>

          <label>
            Address
            <input name="address" placeholder="Business address" />
          </label>

          <label>
            City
            <input name="city" placeholder="Dhaka" />
          </label>

          {state.error ? <p className="form-error">{state.error}</p> : null}

          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? "Creating workspace…" : "Create organization"}
          </button>
        </form>
      </section>
    </main>
  );
}
