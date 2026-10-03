import { ErpPageShell } from "@/components/erp-page-shell";
import { ConfigurationManager } from "@/components/configuration-manager";
import { findCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ExpenseCategoriesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const org = await findCurrentOrganization();
  if (!org) redirect("/onboarding");

  const supabase = await createClient();
  const params = await searchParams;
  const [{ data: rows }, { data: accounts }] = await Promise.all([
    supabase
      .from("expense_categories")
      .select("id,category_code,name,expense_account_id,is_active")
      .eq("organization_id", org.id)
      .order("category_code"),
    supabase
      .from("accounts")
      .select("id,account_code,account_name")
      .eq("organization_id", org.id)
      .eq("is_active", true)
      .eq("account_type", "expense")
      .order("account_code"),
  ]);

  const accountLabels = new Map((accounts ?? []).map((a) => [a.id, a.account_code + " · " + a.account_name]));
  const tableRows = (rows ?? []).map((row) => ({
    ...row,
    expense_account_display: accountLabels.get(row.expense_account_id) ?? "Unknown account",
  }));

  return (
    <ErpPageShell>
      <div className="config-page">
        <div className="page-heading">
          <div className="page-heading-copy">
            <p className="eyebrow">Expenses · Configuration</p>
            <h1>Expense Categories</h1>
            <p>View the expense categories stored in the existing database and their posting-account mappings.</p>
          </div>
        </div>
        <ConfigurationManager
          title="Expense Category"
          description="The live database grants the authenticated role read access to expense_categories only. This screen therefore stays read-only and does not expose actions that the database cannot execute."
          fields={[
            { name: "category_code", label: "Category code" },
            { name: "name", label: "Name" },
            { name: "expense_account_id", label: "Expense account", displayKey: "expense_account_display" },
            { name: "is_active", label: "Active", type: "checkbox" },
          ]}
          rows={tableRows as Record<string, unknown>[]}
          editHref="/expenses/configuration/categories"
          newHref="/expenses/configuration/categories"
          emptyText="No expense categories have been configured yet."
          readOnly
          canCreate={false}
        />
      </div>
    </ErpPageShell>
  );
}
