import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader, PageSection, StatusBadge } from "@/components/ui";
import type { Tables } from "@/lib/supabase/database";

type Contact = Tables<"contacts">;

export function ContactDetail({ contact }: { contact: Contact }) {
  return (
    <div className="page contacts-detail-page">
      <PageHeader eyebrow="Contacts" title={contact.name} description={contact.contact_number ?? "Contact details"} actions={<><Link className="button" href="/contacts"><ArrowLeft size={16} /> Contacts</Link><Link className="button primary" href={`/contacts/new?id=${contact.id}`}><Pencil size={16} /> Edit</Link></>} />
      <PageSection title="Contact details" actions={<StatusBadge tone={contact.is_active ? "success" : "neutral"}>{contact.is_active ? "Active" : "Inactive"}</StatusBadge>}>
        <div className="ui-detail-grid">
          <div><span>Contact number</span><strong>{contact.contact_number ?? "—"}</strong></div>
          <div><span>Name</span><strong>{contact.name}</strong></div>
          <div><span>Phone</span><strong>{contact.phone ?? "—"}</strong></div>
          <div><span>Email</span><strong>{contact.email ?? "—"}</strong></div>
          <div><span>Address</span><strong>{contact.address ?? "—"}</strong></div>
          <div><span>Created</span><strong>{new Date(contact.created_at).toLocaleString()}</strong></div>
          <div><span>Last updated</span><strong>{new Date(contact.updated_at).toLocaleString()}</strong></div>
        </div>
      </PageSection>
    </div>
  );
}
