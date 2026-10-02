import { ErpPageShell } from "@/components/erp-page-shell";
import { ConfigurationManager } from "@/components/configuration-manager";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { saveAccount, toggleAccount } from "@/app/configuration/actions";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const org = await getCurrentOrganization();
  const supabase = await createClient();
  const params = await searchParams;
  const [{ data: rows }, { data: editingRow }, { data: parents }] = await Promise.all([
    supabase.from("accounts").select("id,account_code,account_name,account_type,normal_balance,parent_account_id,is_control_account,is_postable,is_active").eq("organization_id", org.id).order("account_code"),
    params.edit ? supabase.from("accounts").select("id,account_code,account_name,account_type,normal_balance,parent_account_id,is_control_account,is_postable,is_active").eq("organization_id", org.id).eq("id", params.edit).maybeSingle() : Promise.resolve({ data: undefined }),
    supabase.from("accounts").select("id,account_code,account_name").eq("organization_id", org.id).eq("is_active", true).order("account_code"),
  ]);

  return <ErpPageShell>
    <div className="config-page">
      <div className="page-heading"><div className="page-heading-copy"><p className="eyebrow">Accounting · Configuration</p><h1>Chart of Accounts</h1><p>Maintain postable and control accounts used by the double-entry ledger.</p></div></div>
      <ConfigurationManager
        title="Account"
        description="Account codes are maintained in the existing accounts table."
        action={saveAccount}
        toggleAction={toggleAccount}
        fields={[
          { name: "account_code", label: "Account code", required: true },
          { name: "account_name", label: "Account name", required: true },
          { name: "account_type", label: "Account type", required: true, options: ["asset","liability","equity","revenue","expense"].map(v => ({ value: v, label: v })) },
          { name: "normal_balance", label: "Normal balance", required: true, options: [{ value: "debit", label: "Debit" }, { value: "credit", label: "Credit" }] },
          { name: "parent_account_id", label: "Parent account", type: "select", options: (parents ?? []).map(p => ({ value: p.id, label: p.account_code + " · " + p.account_name })) },
          { name: "is_control_account", label: "Control account", type: "checkbox" },
          { name: "is_postable", label: "Postable", type: "checkbox" },
          { name: "is_active", label: "Active", type: "checkbox" },
        ]}
        rows={rows ?? []}
        editingRow={editingRow ?? undefined}
        editHref="/accounting/configuration/accounts"
        newHref="/accounting/configuration/accounts"
        emptyText="No accounts have been configured yet."
      />
    </div>
  </ErpPageShell>;
}
