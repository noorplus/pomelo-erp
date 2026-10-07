import { createClient } from "@/lib/supabase/server"; import { getApplicationContext } from "@/lib/organizations/server"; import { ContactForm } from "@/components/contacts/contact-form";
export default async function NewContactPage(){const c=await getApplicationContext();if(!c.activeOrganization)return null;return <ContactForm organizationId={c.activeOrganization.id} userId={c.user.id}/>;}
