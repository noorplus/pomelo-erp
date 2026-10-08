import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { listAccounts, listExpenseCategories } from "@/lib/accounting/queries";
import { ExpenseCategories } from "@/components/accounting/expense-categories";

export default async function Page() {
  const c = await getApplicationContext();
  if (!c.activeOrganization) return null;
  const s = await createClient();
  const [categories, accounts] = await Promise.all([
    listExpenseCategories(s, c.activeOrganization.id),
    listAccounts(s, c.activeOrganization.id),
  ]);
  return <ExpenseCategories organizationId={c.activeOrganization.id} categories={categories} accounts={accounts} />;
}
