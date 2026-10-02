import { ErpPageShell } from "@/components/erp-page-shell";
import { ConfigurationManager } from "@/components/configuration-manager";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { saveAccount, toggleAccount } from "@/app/configuration/actions";

const accountTypes = ["asset", "liability", "equity", "revenue", "expense"].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
const balances = [{ value: "debit", label: "Debit" }, { value: "credit", label: "Credit" }];

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const org = await getCurrentOrganization();
  const supabase = await createClient();
  const params = await searchParams;
  const [{ data: rows }, { data: editingRow }, { data: parents }] = await Promise.all([
    supabase.from("accounts").select("id,account_code,account_name,account_type,normal_balance,parent_account_id,is_control_account,is_postable,is_system_account,is_active").eq("organization_id", org.id).order("account_code"),
    params.edit ? supabase.from("accounts").select("id,account_code,account_name,account_type,normal_balance,parent_account_id,is_control_account,is_postable,is_system_account,is_active").eq("organization_id", org.id).eq("id", params.edit).maybeSingle() : Promise.resolve({ data: undefined }),
    supabase.from("accounts").select("id,account_code,account_name").eq("organization_id", org.id).eq("is_active", true).order("account_code"),
  ]);

  const parentLabels = new Map((parents ?? []).map(parent => [parent.id, parent.account_code + " · " + parent.account_name]));
  const tableRows = (rows ?? []).map(row => ({
    ...row,
    parent_account_display: row.parent_account_id ? parentLabels.get(row.parent_account_id) ?? "Unknown account" : "—",
    system_account_display: row.is_system_account ? "System account" : "User account",
  }));
  const parentOptions = (parents ?? []).filter(parent => parent.id !== editingRow?.id);

  return <ErpPageShell>
    <div className="config-page">
      <div className="page-heading"><div className="page-heading-copy"><p className="eyebrow">Accounting · Configuration</p><h1>Chart of Accounts</h1><p>Maintain postable and control accounts used by the double-entry ledger.</p></div></div>
      <ConfigurationManager
        title="Account"
        description="Account definitions are stored in the existing accounts table; no new accounting structure is introduced."
        action={saveAccount}
        toggleAction={toggleAccount}
        fields={[
          { name: "account_code", label: "Account code", required: true, placeholder: "e.g. 1000" },
          { name: "account_name", label: "Account name", required: true },
          { name: "account_type", label: "Account type", type: "select", required: true, options: accountTypes },
          { name: "normal_balance", label: "Normal balance", type: "select", required: true, options: balances },
          { name: "parent_account_id", label: "Parent account", type: "select", displayKey: "parent_account_display", options: parentOptions.map(p => ({ value: p.id, label: p.account_code + " · " + p.account_name })) },
          { name: "system_account_display", label: "Account class", readOnly: true, displayKey: "system_account_display" },
          { name: "is_control_account", label: "Control account", type: "checkbox" },
          { name: "is_postable", label: "Postable", type: "checkbox" },
          { name: "is_active", label: "Active", type: "checkbox" },
        ]}
        rows={tableRows}
        editingRow={editingRow ?? undefined}
        editHref="/accounting/configuration/accounts"
        newHref="/accounting/configuration/accounts"
        emptyText="No accounts have been configured yet."
        editDisabledBy={{ field: "is_system_account", values: [true] }}
        toggleDisabledBy={{ field: "is_system_account", values: [true] }}
      />
    </div>
  </ErpPageShell>;
}
