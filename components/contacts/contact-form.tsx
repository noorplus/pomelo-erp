"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createContact, updateContact } from "@/lib/contacts/actions";
import { FormActions, FormField, PageHeader, PageSection } from "@/components/ui";
import { getErrorMessage } from "@/lib/app/errors";
import type { Tables } from "@/lib/supabase/database";

type Contact = Tables<"contacts">;

type Props = {
  organizationId: string;
  userId: string;
  contact?: Contact | null;
};

export function ContactForm({ organizationId, userId, contact }: Props) {
  const router = useRouter();
  const [name, setName] = useState(contact?.name ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [address, setAddress] = useState(contact?.address ?? "");
  const [isActive, setIsActive] = useState(contact?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Contact name is required.");

      const input = {
        name: trimmedName,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        is_active: isActive,
      };

      if (contact) {
        await updateContact(createClient(), organizationId, contact.id, input);
      } else {
        await createContact(createClient(), organizationId, userId, input);
      }

      router.push("/contacts");
      router.refresh();
    } catch (cause) {
      setError(getErrorMessage(cause));
      setBusy(false);
    }
  }

  return (
    <div className="page contacts-form-page">
      <PageHeader
        eyebrow="Contacts"
        title={contact ? "Edit contact" : "New contact"}
        description={
          contact
            ? "Update the contact details stored for this organization."
            : "Create a contact for customers, suppliers, expenses and payments."
        }
      />

      <PageSection title="Contact details">
        <form className="ui-form-grid" onSubmit={submit}>
          <FormField label="Contact number">
            <input
              className="ui-input"
              value={contact?.contact_number ?? "Generated automatically on save"}
              readOnly
            />
            <span className="ui-field-hint">
              Assigned automatically by the frozen CONTACT number sequence.
            </span>
          </FormField>

          <FormField label="Name" htmlFor="contact-name" required>
            <input
              className="ui-input"
              id="contact-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="organization"
              required
            />
          </FormField>

          <FormField label="Phone" htmlFor="contact-phone">
            <input
              className="ui-input"
              id="contact-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
            />
          </FormField>

          <FormField label="Email" htmlFor="contact-email">
            <input
              className="ui-input"
              id="contact-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </FormField>

          <FormField label="Address" htmlFor="contact-address">
            <input
              className="ui-input"
              id="contact-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              autoComplete="street-address"
            />
          </FormField>

          <FormField label="Lifecycle" htmlFor="contact-active">
            <label className="ui-check">
              <input
                id="contact-active"
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Active
            </label>
          </FormField>

          {error ? (
            <p className="ui-field-error" role="alert">
              {error}
            </p>
          ) : null}

          <FormActions>
            <Link className="button" href="/contacts">
              Cancel
            </Link>
            <button className="button primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : contact ? "Save contact" : "Create contact"}
            </button>
          </FormActions>
        </form>
      </PageSection>
    </div>
  );
}
