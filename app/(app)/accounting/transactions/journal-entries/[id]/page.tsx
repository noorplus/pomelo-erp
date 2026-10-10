import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getJournalEntry, getJournalSourceReference } from "@/lib/accounting/queries";
import { JournalEntryDetail } from "@/components/accounting/journal-entry-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const c = await getApplicationContext();
  if (!c.activeOrganization) return null;
  const { id } = await params;
  const s = await createClient();
  let data;
  try {
    data = await getJournalEntry(s, c.activeOrganization.id, id);
  } catch {
    notFound();
  }
  const source = await getJournalSourceReference(
    s,
    c.activeOrganization.id,
    data.header.reference_type,
    data.header.reference_id,
  );
  return (
    <JournalEntryDetail
      entry={data.header}
      lines={data.lines}
      source={source}
      organizationName={c.activeOrganization.name}
      currency={c.activeOrganization.base_currency}
    />
  );
}
