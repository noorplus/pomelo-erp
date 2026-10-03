"use client";

import { useActionState } from "react";
import { createOrganization } from "./actions";

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(createOrganization, {});

  return (
    <main className="auth-shell onboarding-shell">
      <div className="onboarding-layout">
        <header className="onboarding-header">
          <div className="auth-brand"><span className="brand-mark">P</span><strong>Pomelo ERP</strong></div>
          <div className="onboarding-progress"><span className="progress-active">01</span><span>Organization setup</span><i /><span>02</span><span>Dashboard</span></div>
        </header>

        <section className="onboarding-content" aria-labelledby="onboarding-title">
          <div className="onboarding-copy">
            <p className="auth-kicker">Welcome to Pomelo ERP</p>
            <h1 id="onboarding-title">Let&apos;s set up your organization.</h1>
            <p>Your account is ready. Add the organization details used across your ERP workspace. You can update them later in Settings.</p>
            <div className="onboarding-benefits">
              <div><strong>One workspace</strong><span>Keep operational and financial data under your organization.</span></div>
              <div><strong>Local defaults</strong><span>Set currency and timezone once for consistent reporting.</span></div>
              <div><strong>Ready to operate</strong><span>Continue to the dashboard when setup is complete.</span></div>
            </div>
          </div>

          <section className="onboarding-panel">
            <div className="onboarding-panel-heading"><div><p className="eyebrow">Organization profile</p><h2>Workspace details</h2></div><span className="required-note"><b>*</b> Required</span></div>

            <form action={formAction} className="onboarding-form">
              <div className="onboarding-section">
                <div className="section-heading"><span>01</span><div><strong>Organization</strong><small>Core identity and location</small></div></div>
                <div className="onboarding-grid">
                  <label className="auth-field full"><span>Organization name <b>*</b></span><input className="auth-input" name="name" required maxLength={160} autoComplete="organization" autoFocus placeholder="e.g. Noorplus Trading Ltd." /></label>
                  <label className="auth-field"><span>Country <b>*</b></span><input className="auth-input" name="country" required defaultValue="Bangladesh" autoComplete="country-name" /></label>
                  <label className="auth-field"><span>Tax / VAT number</span><input className="auth-input" name="tax_number" autoComplete="off" placeholder="Optional" /></label>
                </div>
              </div>

              <div className="onboarding-section">
                <div className="section-heading"><span>02</span><div><strong>Contact details</strong><small>How your organization can be reached</small></div></div>
                <div className="onboarding-grid">
                  <label className="auth-field"><span>Organization email</span><input className="auth-input" name="email" type="email" autoComplete="email" placeholder="company@example.com" /></label>
                  <label className="auth-field"><span>Phone</span><input className="auth-input" name="phone" type="tel" autoComplete="tel" placeholder="+880..." /></label>
                  <label className="auth-field full"><span>Business address</span><input className="auth-input" name="address" autoComplete="street-address" placeholder="Street, area, building" /></label>
                  <label className="auth-field"><span>City</span><input className="auth-input" name="city" autoComplete="address-level2" placeholder="Dhaka" /></label>
                </div>
              </div>

              <div className="onboarding-section">
                <div className="section-heading"><span>03</span><div><strong>Accounting & locale</strong><small>Defaults for transactions and reports</small></div></div>
                <div className="onboarding-grid">
                  <label className="auth-field"><span>Base currency <b>*</b></span><select className="auth-input" name="base_currency" defaultValue="BDT" required><option value="BDT">BDT — Bangladeshi Taka</option><option value="USD">USD — US Dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — British Pound</option><option value="INR">INR — Indian Rupee</option><option value="AUD">AUD — Australian Dollar</option><option value="CAD">CAD — Canadian Dollar</option><option value="SGD">SGD — Singapore Dollar</option></select></label>
                  <label className="auth-field"><span>Timezone <b>*</b></span><select className="auth-input" name="timezone" defaultValue="Asia/Dhaka" required><option value="Asia/Dhaka">Asia/Dhaka (Bangladesh)</option><option value="Asia/Kolkata">Asia/Kolkata (India)</option><option value="Asia/Singapore">Asia/Singapore</option><option value="Asia/Dubai">Asia/Dubai (UAE)</option><option value="Europe/London">Europe/London (UK)</option><option value="UTC">UTC</option></select></label>
                </div>
              </div>

              {state.error ? <p className="auth-message error" role="alert">{state.error}</p> : null}

              <div className="onboarding-actions">
                <p>By continuing, your signed-in account becomes the organization owner.</p>
                <button className="auth-primary" type="submit" disabled={pending}>{pending ? <><span className="auth-spinner" aria-hidden="true" />Creating workspace…</> : "Create organization & continue"}</button>
              </div>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
