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
        <h1>Set up your organization</h1>
        <p className="auth-copy">
          Create your ERP workspace. Your signed-in account will automatically become its owner.
        </p>

        <form action={formAction} className="form-stack">
          <div className="form-section">
            <p className="form-section-title">Organization</p>

            <label>
              Organization name <span aria-hidden="true">*</span>
              <input
                name="name"
                required
                maxLength={160}
                autoComplete="organization"
                placeholder="Your company name"
              />
            </label>

            <label>
              Country <span aria-hidden="true">*</span>
              <input
                name="country"
                required
                defaultValue="Bangladesh"
                autoComplete="country-name"
                placeholder="Country"
              />
            </label>

            <label>
              Tax / VAT number
              <input
                name="tax_number"
                autoComplete="off"
                placeholder="Optional tax or VAT registration number"
              />
            </label>
          </div>

          <div className="form-section">
            <p className="form-section-title">Contact</p>

            <label>
              Phone
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+880..."
              />
            </label>

            <label>
              Organization email
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="company@example.com"
              />
            </label>

            <label>
              Address
              <input
                name="address"
                autoComplete="street-address"
                placeholder="Business address"
              />
            </label>

            <label>
              City
              <input
                name="city"
                autoComplete="address-level2"
                placeholder="Dhaka"
              />
            </label>
          </div>

          <div className="form-section">
            <p className="form-section-title">Accounting & locale</p>

            <label>
              Base currency <span aria-hidden="true">*</span>
              <select name="base_currency" defaultValue="BDT" required>
                <option value="BDT">BDT — Bangladeshi Taka</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="INR">INR — Indian Rupee</option>
                <option value="AUD">AUD — Australian Dollar</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="SGD">SGD — Singapore Dollar</option>
              </select>
              <small>Used as the organization-wide accounting currency.</small>
            </label>

            <label>
              Timezone <span aria-hidden="true">*</span>
              <select name="timezone" defaultValue="Asia/Dhaka" required>
                <option value="Asia/Dhaka">Asia/Dhaka (Bangladesh)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (India)</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
                <option value="Asia/Dubai">Asia/Dubai (UAE)</option>
                <option value="Europe/London">Europe/London (UK)</option>
                <option value="UTC">UTC</option>
              </select>
              <small>Used for dates, timestamps, accounting periods, and reports.</small>
            </label>
          </div>

          {state.error ? (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          ) : null}

          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? "Creating workspace…" : "Create organization"}
          </button>

          <p className="auth-copy onboarding-note">
            You can update the organization profile and other ERP settings later from Settings.
          </p>
        </form>
      </section>
    </main>
  );
}
