import { ErpPageShell } from "@/components/erp-page-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function ContactsPage() {
  return (
    <ErpPageShell>
      <ModulePlaceholder title="Contacts" description="Contacts will be completed from the existing contacts and transaction-reference database model." />
    </ErpPageShell>
  );
}
