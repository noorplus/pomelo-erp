import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getContact } from "@/lib/contacts/queries";
import { ContactForm } from "@/components/contacts/contact-form";

type Props = {
  searchParams: Promise<{ id?: string }>;
};

export default async function NewContactPage({ searchParams }: Props) {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;

  const params = await searchParams;
  const result = params.id
    ? await getContact(await createClient(), context.activeOrganization.id, params.id)
    : null;

  if (params.id && !result?.contact) notFound();

  return (
    <ContactForm
      organizationId={context.activeOrganization.id}
      userId={context.user.id}
      contact={result?.contact ?? null}
    />
  );
}
