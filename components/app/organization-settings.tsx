"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addOrganizationUserByEmail, removeOrganizationUser, updateOrganization } from "@/lib/organizations/actions";
import { FormActions, FormField, PageHeader, PageSection, StatusBadge } from "@/components/ui";
import { getErrorMessage } from "@/lib/app/errors";
import type { Organization, OrganizationMembership } from "@/lib/app/types";

export function OrganizationSettings({ organization, memberships, userId, creator }: {
  organization: Organization; memberships: OrganizationMembership[]; userId: string; creator: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: organization.name, phone: organization.phone ?? "", email: organization.email ?? "",
    address: organization.address ?? "", city: organization.city ?? "", country: organization.country ?? "",
    baseCurrency: organization.base_currency, timezone: organization.timezone, tin: organization.tin ?? "", bin: organization.bin ?? "",
  });
  const [memberEmail, setMemberEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function field(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: key === "baseCurrency" ? value.toUpperCase().slice(0, 3) : value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      if (!form.name.trim()) throw new Error("Organization name is required.");
      if (!/^[A-Z]{3}$/.test(form.baseCurrency)) throw new Error("Currency must be a 3-letter ISO code.");
      if (!form.timezone.trim()) throw new Error("Timezone is required.");
      await updateOrganization(createClient(), organization.id, {
        name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null,
        address: form.address.trim() || null, city: form.city.trim() || null, country: form.country.trim() || null,
        baseCurrency: form.baseCurrency, timezone: form.timezone.trim(), tin: form.tin.trim() || null, bin: form.bin.trim() || null,
      });
      setMessage("Organization settings saved."); router.refresh();
    } catch (cause) { setError(getErrorMessage(cause)); } finally { setSaving(false); }
  }

  async function addMember(event: React.FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    try {
      if (!memberEmail.trim()) throw new Error("Member email is required.");
      await addOrganizationUserByEmail(createClient(), organization.id, memberEmail.trim());
      setMemberEmail(""); setMessage("Member added."); router.refresh();
    } catch (cause) { setError(getErrorMessage(cause)); }
  }

  async function removeMember(userId: string) {
    setError(""); setMessage("");
    try {
      await removeOrganizationUser(createClient(), organization.id, userId);
      setMessage("Member removed."); router.refresh();
    } catch (cause) { setError(getErrorMessage(cause)); }
  }

  const fields: [keyof typeof form, string][] = [
    ["name","Organization name"],["phone","Phone"],["email","Email"],["address","Address"],["city","City"],
    ["country","Country"],["baseCurrency","Base currency"],["timezone","Timezone"],["tin","TIN"],["bin","BIN"],
  ];

  return (
    <div className="page">
      <PageHeader eyebrow="Organization" title="Organization settings" description="Manage the organization profile and active membership using the frozen database contracts." />
      <PageSection title="Profile">
        <form onSubmit={save} className="ui-form-grid">
          {fields.map(([key, label]) => <FormField key={key} label={label} htmlFor={`org-${key}`} required={key === "name" || key === "baseCurrency" || key === "timezone"}><input className="ui-input" id={`org-${key}`} value={form[key]} onChange={(e) => field(key, e.target.value)} /></FormField>)}
          {message ? <p className="ui-field-hint" role="status">{message}</p> : null}
          {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
          <FormActions><button className="button primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save changes"}</button></FormActions>
        </form>
      </PageSection>
      <PageSection title="Members" description={creator ? "You are the organization creator. The creator membership is protected by the database." : "Membership operations use the supported database RPCs."}>
        <form onSubmit={addMember} className="ui-member-form">
          <FormField label="Add member by email" htmlFor="member-email" required><input className="ui-input" id="member-email" type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="user@example.com" /></FormField>
          <button className="button primary" type="submit">Add member</button>
        </form>
        <div className="ui-table-wrap"><table className="ui-table"><thead><tr><th>User ID</th><th>Status</th><th>Added</th><th>Action</th></tr></thead><tbody>
          {memberships.map((member) => <tr key={member.id}><td><code>{member.user_id}</code>{member.user_id === userId ? " (you)" : ""}</td><td><StatusBadge tone={member.is_active ? "success" : "neutral"}>{member.is_active ? "Active" : "Inactive"}</StatusBadge></td><td>{new Date(member.created_at).toLocaleDateString()}</td><td>{member.user_id === userId || (creator && member.id === memberships[0]?.id) ? <span className="ui-field-hint">Protected</span> : <button className="button" type="button" onClick={() => removeMember(member.user_id)}>Remove</button>}</td></tr>)}
        </tbody></table></div>
      </PageSection>
    </div>
  );
}
