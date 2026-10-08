import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getContact } from "@/lib/contacts/queries";
import { ContactForm } from "@/components/contacts/contact-form";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;
  const contact = await getContact(await createClient(), context.activeOrganization.id, (await params).id);
  if (!contact) notFound();
  return <ContactForm organizationId={context.activeOrganization.id} userId={context.user.id} contact={contact} />;
}
