import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { listContacts } from "@/lib/contacts/queries";
import { ContactsList } from "@/components/contacts/contacts-list";

export default async function ContactsPage() {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;

  const contacts = await listContacts(
    await createClient(),
    context.activeOrganization.id,
  );

  return <ContactsList rows={contacts} />;
}
