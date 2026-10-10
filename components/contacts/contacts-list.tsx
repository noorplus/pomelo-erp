"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DataTable, PageHeader, PageSection, SearchInput, StatusBadge } from "@/components/ui";
import type { Tables } from "@/lib/supabase/database";

type Contact = Tables<"contacts">;

export function ContactsList({ rows }: { rows: Contact[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((contact) =>
      [contact.contact_number ?? "", contact.name, contact.phone ?? "", contact.email ?? "", contact.address ?? ""]
        .some((field) => field.toLowerCase().includes(value)),
    );
  }, [query, rows]);

  return (
    <div className="page contacts-page">
      <PageHeader eyebrow="Contacts" title="Contacts" description="Manage the people and businesses referenced by purchasing, sales, expenses and payments." actions={<Link className="button primary" href="/contacts/new">New contact</Link>} />
      <PageSection title="Contacts" description={`${filtered.length} of ${rows.length} contact${rows.length === 1 ? "" : "s"}`} actions={<SearchInput value={query} onChange={setQuery} placeholder="Search number, name, phone, email or address" />}>
        <DataTable
          rows={filtered}
          columns={[
            { key: "number", header: "Number", render: (contact) => <Link href={`/contacts/${contact.id}`}>{contact.contact_number ?? "—"}</Link> },
            { key: "name", header: "Name", render: (contact) => <Link href={`/contacts/${contact.id}`}>{contact.name}</Link> },
            { key: "phone", header: "Phone", render: (contact) => contact.phone ?? "—" },
            { key: "email", header: "Email", render: (contact) => contact.email ?? "—" },
            { key: "status", header: "Status", render: (contact) => <StatusBadge tone={contact.is_active ? "success" : "neutral"}>{contact.is_active ? "Active" : "Inactive"}</StatusBadge> },
            { key: "action", header: "Action", render: (contact) => <Link className="button" href={`/contacts/new?id=${contact.id}`}>Edit</Link> },
          ]}
          empty="No contacts found."
        />
      </PageSection>
    </div>
  );
}
