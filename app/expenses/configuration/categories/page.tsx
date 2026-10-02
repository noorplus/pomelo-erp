import { ErpPageShell } from "@/components/erp-page-shell";
import { ConfigurationManager } from "@/components/configuration-manager";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { saveExpenseCategory, toggleExpenseCategory } from "@/app/configuration/actions";

export default async function ExpenseCategoriesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const org = await getCurrentOrganization();
  const supabase = await createClient();
  const params = await searchParams;
  const [{ data: rows }, { data: editingRow }, { data: accounts }] = await Promise.all([
    supabase.from("expense_categories").select("id,category_code,name,expense_account_id,is_active").eq("organization_id", org.id).order("category_code"),
    params.edit ? supabase.from("expense_categories").select("id,category_code,name,expense_account_id,is_active").eq("organization_id", org.id).eq("id", params.edit).maybeSingle() : Promise.resolve({ data: undefined }),
    supabase.from("accounts").select("id,account_code,account_name").eq("organization_id", org.id).eq("is_active", true).eq("account_type", "expense").order("account_code"),
  ]);
  const accountLabels = new Map((accounts ?? []).map(a => [a.id, a.account_code + " · " + a.account_name]));
  const tableRows = (rows ?? []).map(row => ({
    ...row,
    expense_account_display: accountLabels.get(row.expense_account_id) ?? "Unknown account",
  }));

  return <ErpPageShell>
    <div className="config-page">
      <div className="page-heading"><div className="page-heading-copy"><p className="eyebrow">Expenses · Configuration</p><h1>Expense Categories</h1><p>Classify expenses and map each category to its posting account.</p></div></div>
      <ConfigurationManager
        title="Expense Category"
        description="Expense categories use the existing expense_categories table."
        action={saveExpenseCategory}
        toggleAction={toggleExpenseCategory}
        fields={[
          { name: "category_code", label: "Category code", required: true },
          { name: "name", label: "Name", required: true },
          { name: "expense_account_id", label: "Expense account", displayKey:"expense_account_display", type: "select", required: true, options: (accounts ?? []).map(a => ({ value: a.id, label: a.account_code + " · " + a.account_name })) },
          { name: "is_active", label: "Active", type: "checkbox" },
        ]}
        rows={tableRows as Record<string, unknown>[]}
        editingRow={editingRow as Record<string, unknown> | undefined}
        editHref="/expenses/configuration/categories"
        newHref="/expenses/configuration/categories"
        emptyText="No expense categories have been configured yet."
      />
    </div>
  </ErpPageShell>;
}
