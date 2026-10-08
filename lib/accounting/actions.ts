import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database";

type AccountInsert = Omit<TablesInsert<"accounts">, "organization_id">;
type AccountUpdate = Omit<TablesUpdate<"accounts">, "organization_id">;

async function callRpc(supabase: TypedSupabaseClient, name: string, args: Record<string, unknown>, message: string) {
  const { error } = await supabase.rpc(name as never, args as never);
  if (error) throwSupabaseError(error, "RPC_ERROR", message);
}

export async function createAccountingPeriod(supabase: TypedSupabaseClient, input: { organizationId: string; name: string; startDate: string; endDate: string }) {
  const { data, error } = await supabase.rpc("create_accounting_period", {
    p_organization_id: input.organizationId, p_name: input.name, p_start_date: input.startDate, p_end_date: input.endDate,
  });
  if (error) throwSupabaseError(error, "RPC_ERROR", "Unable to create the accounting period.");
  return data;
}

export async function closeAccountingPeriod(supabase: TypedSupabaseClient, periodId: string) {
  await callRpc(supabase, "close_accounting_period", { p_period_id: periodId }, "Unable to close the accounting period.");
}

export async function createAccount(supabase: TypedSupabaseClient, organizationId: string, input: AccountInsert) {
  const { data, error } = await supabase.from("accounts").insert({ ...input, organization_id: organizationId }).select("id").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the account.");
  return data.id;
}

export async function updateAccount(supabase: TypedSupabaseClient, organizationId: string, accountId: string, input: AccountUpdate) {
  const { data: existing, error: lookupError } = await supabase.from("accounts").select("is_system_account").eq("organization_id", organizationId).eq("id", accountId).single();
  if (lookupError) throwSupabaseError(lookupError, "DATABASE_ERROR", "Unable to load the account.");
  if (existing.is_system_account) throw new Error("System accounts are managed by the ERP and cannot be edited here.");
  const { error } = await supabase.from("accounts").update(input).eq("organization_id", organizationId).eq("id", accountId);
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to update the account.");
}

export async function deactivateAccount(supabase: TypedSupabaseClient, organizationId: string, accountId: string) {
  await updateAccount(supabase, organizationId, accountId, { is_active: false });
}

export async function confirmJournalEntry(supabase: TypedSupabaseClient, id: string) { await callRpc(supabase, "confirm_journal_entry", { p_journal_entry_id: id }, "Unable to confirm journal entry."); }
export async function cancelJournalEntry(supabase: TypedSupabaseClient, id: string) { await callRpc(supabase, "cancel_journal_entry", { p_journal_entry_id: id }, "Unable to cancel journal entry."); }
export async function confirmPayment(supabase: TypedSupabaseClient, id: string) { await callRpc(supabase, "confirm_payment", { p_id: id }, "Unable to confirm payment."); }
export async function cancelPayment(supabase: TypedSupabaseClient, id: string) { await callRpc(supabase, "cancel_payment", { p_id: id }, "Unable to cancel payment."); }
export async function confirmExpense(supabase: TypedSupabaseClient, id: string) { await callRpc(supabase, "confirm_expense", { p_id: id }, "Unable to confirm expense."); }
export async function cancelExpense(supabase: TypedSupabaseClient, id: string) { await callRpc(supabase, "cancel_expense", { p_id: id }, "Unable to cancel expense."); }

export async function createJournalEntry(
  supabase: TypedSupabaseClient,
  organizationId: string,
  header: TablesInsert<"journal_entries">,
  lines: Array<Omit<TablesInsert<"account_transactions">, "organization_id" | "journal_entry_id" | "line_number">>,
) {
  const { data, error } = await supabase.from("journal_entries").insert({ ...header, organization_id: organizationId }).select("id").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the journal entry.");
  const { error: lineError } = await supabase.from("account_transactions").insert(lines.map((line, index) => ({
    ...line, organization_id: organizationId, journal_entry_id: data.id, line_number: index + 1,
  })));
  if (lineError) {
    await supabase.from("journal_entries").delete().eq("organization_id", organizationId).eq("id", data.id);
    throwSupabaseError(lineError, "DATABASE_ERROR", "Unable to create journal entry lines.");
  }
  return data.id;
}

export async function createOpeningBalance(
  supabase: TypedSupabaseClient,
  organizationId: string,
  input: { accountingPeriodId: string; entryDate: string; lines: Array<{ account_id: string; debit: number; credit: number }> },
) {
  const id = await createJournalEntry(supabase, organizationId, {
    organization_id: organizationId,
    entry_number: null,
    accounting_period_id: input.accountingPeriodId,
    entry_date: input.entryDate,
    entry_type: "OPENING",
    status: "DRAFT",
    reference_type: null,
    reference_id: null,
    description: "Opening balance",
    posted_at: null,
    reversal_of_id: null,
    created_by: null,
  }, input.lines.map((line) => ({ ...line, description: "Opening balance", contact_id: null })));
  await confirmJournalEntry(supabase, id);
  return id;
}

export async function createPayment(supabase: TypedSupabaseClient, organizationId: string, input: TablesInsert<"payments">) {
  const { data, error } = await supabase.from("payments").insert({ ...input, organization_id: organizationId }).select("id").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the payment.");
  return data.id;
}

export async function createPaymentAllocation(
  supabase: TypedSupabaseClient,
  organizationId: string,
  input: Omit<TablesInsert<"payment_allocations">, "organization_id">,
) {
  const { data, error } = await supabase.from("payment_allocations").insert({ ...input, organization_id: organizationId }).select("id").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the payment allocation.");
  return data.id;
}

export async function deletePaymentAllocation(supabase: TypedSupabaseClient, organizationId: string, id: string) {
  const { error } = await supabase.from("payment_allocations").delete().eq("organization_id", organizationId).eq("id", id);
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to remove the payment allocation.");
}

export async function createExpense(supabase: TypedSupabaseClient, organizationId: string, input: TablesInsert<"expenses">) {
  const { data, error } = await supabase.from("expenses").insert({ ...input, organization_id: organizationId }).select("id").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the expense.");
  return data.id;
}

export async function createExpenseCategory(
  supabase: TypedSupabaseClient,
  organizationId: string,
  input: Omit<TablesInsert<"expense_categories">, "organization_id">,
) {
  const { data, error } = await supabase.from("expense_categories").insert({ ...input, organization_id: organizationId }).select("id").single();
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to create the expense category.");
  return data.id;
}

export async function updateExpenseCategory(
  supabase: TypedSupabaseClient,
  organizationId: string,
  id: string,
  input: Omit<TablesUpdate<"expense_categories">, "organization_id">,
) {
  const { error } = await supabase.from("expense_categories").update(input).eq("organization_id", organizationId).eq("id", id);
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to update the expense category.");
}

export async function deactivateExpenseCategory(supabase: TypedSupabaseClient, organizationId: string, id: string) {
  await updateExpenseCategory(supabase, organizationId, id, { is_active: false });
}
