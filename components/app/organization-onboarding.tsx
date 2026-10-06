"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createOrganization } from "@/lib/organizations/actions";
import { FormActions, FormField, PageHeader, PageSection, Select } from "@/components/ui";
import { getErrorMessage } from "@/lib/app/errors";

export function OrganizationOnboarding() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("BDT");
  const [timezone, setTimezone] = useState("Asia/Dhaka");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return setError("Organization name is required.");
    if (!/^[A-Z]{3}$/.test(currency)) return setError("Currency must be a 3-letter ISO code.");
    setSaving(true); setError("");
    try {
      await createOrganization(createClient(), { name: trimmedName, baseCurrency: currency, timezone });
      router.refresh();
    } catch (cause) {
      setError(getErrorMessage(cause)); setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Organization setup" title="Create your organization" description="Create the ERP workspace through the frozen onboarding contract." />
      <PageSection title="Workspace details" description="Onboarding also initializes the current accounting period and required system configuration.">
        <form onSubmit={submit} className="ui-form-grid">
          <FormField label="Organization name" htmlFor="org-name" required><input className="ui-input" id="org-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" required /></FormField>
          <FormField label="Base currency" htmlFor="org-currency" required hint="Three-letter ISO currency code."><input className="ui-input" id="org-currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} required /></FormField>
          <FormField label="Timezone" htmlFor="org-timezone" required><Select id="org-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}><option value="Asia/Dhaka">Asia/Dhaka</option><option value="UTC">UTC</option></Select></FormField>
          {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
          <FormActions><button className="button primary" disabled={saving} type="submit">{saving ? "Creating…" : "Create organization"}</button></FormActions>
        </form>
      </PageSection>
    </div>
  );
}
