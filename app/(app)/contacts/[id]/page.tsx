import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getContact } from "@/lib/contacts/queries";
import { ContactDetail } from "@/components/contacts/contact-detail";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;
  const result = await getContact(await createClient(), context.activeOrganization.id, (await params).id);
  if (!result.contact) notFound();
  return <ContactDetail contact={result.contact} activity={result.activity} />;
}