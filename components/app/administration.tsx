"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, FileText, Pencil, Plus, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addOrganizationUserByEmail, removeOrganizationUser, updateOrganization } from "@/lib/organizations/actions";
import { DataTable, FormField, FormActions, StatusBadge } from "@/components/ui";
import { getErrorMessage } from "@/lib/app/errors";
import { formatDate } from "@/lib/formatters";
import type { Organization, OrganizationMembership } from "@/lib/app/types";
import type { Tables } from "@/lib/supabase/database";

type NumberSequence = Tables<"number_sequences">;

type Props = {
  organization: Organization;
  memberships: OrganizationMembership[];
  userId: string;
  creator: boolean;
  numberSequences: NumberSequence[];
};

export function Administration({ organization, memberships, userId, creator, numberSequences }: Props) {
  const router = useRouter();
  const [editingOrganization, setEditingOrganization] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberSaving, setMemberSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: organization.name,
    phone: organization.phone ?? "",
    email: organization.email ?? "",
    address: organization.address ?? "",
    city: organization.city ?? "",
    country: organization.country ?? "",
    baseCurrency: organization.base_currency,
    timezone: organization.timezone,
    tin: organization.tin ?? "",
    bin: organization.bin ?? "",
  });

  const activeMembers = memberships.filter((member) => member.is_active).length;

  function field(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: key === "baseCurrency" ? value.toUpperCase().slice(0, 3) : value }));
  }

  function startEditing() { setMessage(""); setError(""); setEditingOrganization(true); }

  function cancelEditing() {
    setForm({
      name: organization.name,
      phone: organization.phone ?? "",
      email: organization.email ?? "",
      address: organization.address ?? "",
      city: organization.city ?? "",
      country: organization.country ?? "",
      baseCurrency: organization.base_currency,
      timezone: organization.timezone,
      tin: organization.tin ?? "",
      bin: organization.bin ?? "",
    });
    setMessage("");
    setError("");
    setEditingOrganization(false);
  }

  async function saveOrganization(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage(""); setError("");
    try {
      if (!form.name.trim()) throw new Error("Organization name is required.");
      if (!/^[A-Z]{3}$/.test(form.baseCurrency)) throw new Error("Currency must be a 3-letter ISO code.");
      if (!form.timezone.trim()) throw new Error("Timezone is required.");
      await updateOrganization(createClient(), organization.id, {
        name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null,
        address: form.address.trim() || null, city: form.city.trim() || null, country: form.country.trim() || null,
        baseCurrency: form.baseCurrency, timezone: form.timezone.trim(), tin: form.tin.trim() || null, bin: form.bin.trim() || null,
      });
      setMessage("Organization details saved."); setEditingOrganization(false); router.refresh();
    } catch (cause) { setError(getErrorMessage(cause)); } finally { setSaving(false); }
  }

  async function addMember(event: React.FormEvent) {
    event.preventDefault(); setMemberSaving(true); setError(""); setMessage("");
    try {
      if (!memberEmail.trim()) throw new Error("Member email is required.");
      await addOrganizationUserByEmail(createClient(), organization.id, memberEmail.trim());
      setMemberEmail(""); setMessage("User added to the organization."); router.refresh();
    } catch (cause) { setError(getErrorMessage(cause)); } finally { setMemberSaving(false); }
  }

  async function removeMember(memberUserId: string) {
    setError(""); setMessage("");
    try {
      await removeOrganizationUser(createClient(), organization.id, memberUserId);
      setMessage("User removed from the organization."); router.refresh();
    } catch (cause) { setError(getErrorMessage(cause)); }
  }

  const membershipColumns = [
    { key: "user", header: "User", render: (member: OrganizationMembership) => <>{member.user_id}{member.user_id === userId ? " (you)" : ""}</> },
    { key: "status", header: "Status", render: (member: OrganizationMembership) => <StatusBadge tone={member.is_active ? "success" : "neutral"}>{member.is_active ? "Active" : "Inactive"}</StatusBadge> },
    { key: "added", header: "Added", render: (member: OrganizationMembership) => formatDate(member.created_at) },
    { key: "action", header: "Action", render: (member: OrganizationMembership) => {
      const protectedMember = member.user_id === userId || (creator && member.id === memberships[0]?.id);
      return protectedMember ? <span className="ui-field-hint">Protected</span> : <button className="button" type="button" onClick={() => removeMember(member.user_id)}>Remove</button>;
    }},
  ];

  return (
    <div className="page administration-page">
      <div className="administration-intro">
        <div><p className="eyebrow">Administration</p><h1>Organization administration</h1><p className="lede">Keep organization details and membership in one simple place.</p></div>
        <StatusBadge tone="success">Database-backed</StatusBadge>
      </div>

      <section className="administration-panel">
        <div className="administration-panel-header">
          <div className="administration-panel-title"><span className="administration-icon"><Building2 size={18} /></span><div><h2>Organization</h2><p>All organization information currently stored in the database.</p></div></div>
          {!editingOrganization ? <button className="button" type="button" onClick={startEditing}><Pencil size={16} /> Edit organization</button> : null}
        </div>
        {editingOrganization ? (
          <form className="administration-form" onSubmit={saveOrganization}>
            <div className="ui-form-grid">
              <FormField label="Organization name" htmlFor="admin-org-name" required><input className="ui-input" id="admin-org-name" value={form.name} onChange={(e) => field("name", e.target.value)} /></FormField>
              <FormField label="Base currency" htmlFor="admin-org-currency" required><input className="ui-input" id="admin-org-currency" value={form.baseCurrency} onChange={(e) => field("baseCurrency", e.target.value)} maxLength={3} /></FormField>
              <FormField label="Phone" htmlFor="admin-org-phone"><input className="ui-input" id="admin-org-phone" value={form.phone} onChange={(e) => field("phone", e.target.value)} /></FormField>
              <FormField label="Email" htmlFor="admin-org-email"><input className="ui-input" id="admin-org-email" type="email" value={form.email} onChange={(e) => field("email", e.target.value)} /></FormField>
              <FormField label="Address" htmlFor="admin-org-address"><input className="ui-input" id="admin-org-address" value={form.address} onChange={(e) => field("address", e.target.value)} /></FormField>
              <FormField label="City" htmlFor="admin-org-city"><input className="ui-input" id="admin-org-city" value={form.city} onChange={(e) => field("city", e.target.value)} /></FormField>
              <FormField label="Country" htmlFor="admin-org-country"><input className="ui-input" id="admin-org-country" value={form.country} onChange={(e) => field("country", e.target.value)} /></FormField>
              <FormField label="Timezone" htmlFor="admin-org-timezone" required><input className="ui-input" id="admin-org-timezone" value={form.timezone} onChange={(e) => field("timezone", e.target.value)} /></FormField>
              <FormField label="TIN" htmlFor="admin-org-tin"><input className="ui-input" id="admin-org-tin" value={form.tin} onChange={(e) => field("tin", e.target.value)} /></FormField>
              <FormField label="BIN" htmlFor="admin-org-bin"><input className="ui-input" id="admin-org-bin" value={form.bin} onChange={(e) => field("bin", e.target.value)} /></FormField>
            </div>
            <FormActions><button className="button" type="button" onClick={cancelEditing} disabled={saving}><X size={16} /> Cancel</button><button className="button primary" type="submit" disabled={saving}><Check size={16} /> {saving ? "Saving…" : "Save changes"}</button></FormActions>
          </form>
        ) : (
          <div className="administration-details">
            <div className="administration-detail administration-detail-wide"><span>Organization name</span><strong>{organization.name}</strong></div>
            <div className="administration-detail"><span>Phone</span><strong>{organization.phone || "—"}</strong></div>
            <div className="administration-detail"><span>Email</span><strong>{organization.email || "—"}</strong></div>
            <div className="administration-detail administration-detail-wide"><span>Address</span><strong>{organization.address || "—"}</strong></div>
            <div className="administration-detail"><span>City</span><strong>{organization.city || "—"}</strong></div>
            <div className="administration-detail"><span>Country</span><strong>{organization.country || "—"}</strong></div>
            <div className="administration-detail"><span>Base currency</span><strong>{organization.base_currency}</strong></div>
            <div className="administration-detail"><span>Timezone</span><strong>{organization.timezone}</strong></div>
            <div className="administration-detail"><span>TIN</span><strong>{organization.tin || "—"}</strong></div>
            <div className="administration-detail"><span>BIN</span><strong>{organization.bin || "—"}</strong></div>
          </div>
        )}
      </section>

      <section className="administration-panel">
        <div className="administration-panel-header">
          <div className="administration-panel-title"><span className="administration-icon"><Users size={18} /></span><div><h2>Users</h2><p>{activeMembers} active member{activeMembers === 1 ? "" : "s"} in this organization.</p></div></div>
          <StatusBadge tone="info">Membership</StatusBadge>
        </div>
        <form className="administration-member-add" onSubmit={addMember}>
          <FormField label="Add user by email" htmlFor="admin-member-email" required><input className="ui-input" id="admin-member-email" type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="user@example.com" /></FormField>
          <button className="button primary" type="submit" disabled={memberSaving}><Plus size={16} /> {memberSaving ? "Adding…" : "Add user"}</button>
        </form>
        <DataTable rows={memberships} columns={membershipColumns} empty="No organization users found." />
        <p className="ui-field-hint administration-note">User names, roles, and permissions are not shown because those capabilities are not stored in the frozen application database.</p>
      </section>

      <section className="administration-panel">
        <div className="administration-panel-header">
          <div className="administration-panel-title"><span className="administration-icon"><FileText size={18} /></span><div><h2>Document numbering</h2><p>System-managed numbering sequences. Values are read-only.</p></div></div>
          <StatusBadge tone="info">System-managed</StatusBadge>
        </div>
        <DataTable rows={numberSequences} columns={[
          { key: "document_type", header: "Document", render: (row: NumberSequence) => row.document_type },
          { key: "prefix", header: "Prefix", render: (row: NumberSequence) => row.prefix },
          { key: "next_number", header: "Next number", render: (row: NumberSequence) => row.next_number.toString() },
          { key: "padding", header: "Padding", render: (row: NumberSequence) => row.padding.toString() },
          { key: "preview", header: "Next generated", render: (row: NumberSequence) => row.prefix + String(row.next_number).padStart(row.padding, "0") },
          { key: "status", header: "Status", render: (row: NumberSequence) => <StatusBadge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Active" : "Inactive"}</StatusBadge> },
        ]} empty="No number sequences found." />
      </section>

      {(message || error) ? <p className={error ? "ui-field-error administration-message" : "ui-field-hint administration-message"} role={error ? "alert" : "status"}>{error || message}</p> : null}
    </div>
  );
}
