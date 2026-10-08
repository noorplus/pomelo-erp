import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";

export async function listAccountingPeriods(supabase: TypedSupabaseClient, organizationId: string) {
  const { data, error } = await supabase.from("accounting_periods").select("*").eq("organization_id", organizationId).order("start_date", { ascending: false });
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load accounting periods.");
  return data;
}

export async function listAccounts(supabase: TypedSupabaseClient, organizationId: string) {
  const { data, error } = await supabase.from("accounts").select("*").eq("organization_id", organizationId).order("account_code", { ascending: true });
  if (error) throwSupabaseError(error, "DATABASE_ERROR", "Unable to load chart of accounts.");
  return data;
}

export async function getAccountingDashboard(supabase: TypedSupabaseClient, organizationId: string) {
  const [{ data: accounts, error: accountsError }, { data: periods, error: periodsError }] = await Promise.all([
    supabase.from("accounts").select("id, account_code, account_name, account_type, is_active").eq("organization_id", organizationId),
    supabase.from("accounting_periods").select("id, name, start_date, end_date, status").eq("organization_id", organizationId).order("start_date", { ascending: false }),
  ]);
  if (accountsError) throwSupabaseError(accountsError, "DATABASE_ERROR", "Unable to load accounting accounts.");
  if (periodsError) throwSupabaseError(periodsError, "DATABASE_ERROR", "Unable to load accounting periods.");

  const openPeriod = periods.find((period) => period.status === "OPEN") ?? null;
  const dateStart = openPeriod?.start_date ?? null;
  const dateEnd = openPeriod?.end_date ?? null;

  const dateFilter = <T extends { gte: (column: string, value: string) => T; lte: (column: string, value: string) => T }>(query: T) => {
    if (!dateStart || !dateEnd) return query;
    return query.gte("entry_date", dateStart).lte("entry_date", dateEnd);
  };

  const journalQuery = dateFilter(
    supabase.from("journal_entries").select("id, entry_number, entry_date, entry_type, status, description, posted_at").eq("organization_id", organizationId).order("entry_date", { ascending: false }),
  );
  const { data: journalEntries, error: journalError } = await journalQuery;
  if (journalError) throwSupabaseError(journalError, "DATABASE_ERROR", "Unable to load journal entries.");

  let accountTransactionsQuery = supabase.from("account_transactions").select("debit, credit").eq("organization_id", organizationId);
  if (dateStart && dateEnd) {
    const { data: periodEntries, error: periodEntriesError } = await supabase.from("journal_entries").select("id").eq("organization_id", organizationId).gte("entry_date", dateStart).lte("entry_date", dateEnd);
    if (periodEntriesError) throwSupabaseError(periodEntriesError, "DATABASE_ERROR", "Unable to load accounting activity.");
    const ids = (periodEntries ?? []).map((entry) => entry.id);
    accountTransactionsQuery = ids.length ? accountTransactionsQuery.in("journal_entry_id", ids) : accountTransactionsQuery.eq("journal_entry_id", "00000000-0000-0000-0000-000000000000");
  }
  const { data: accountTransactions, error: transactionError } = await accountTransactionsQuery;
  if (transactionError) throwSupabaseError(transactionError, "DATABASE_ERROR", "Unable to load account activity.");

  let paymentsQuery = supabase.from("payments").select("amount, status").eq("organization_id", organizationId);
  if (dateStart && dateEnd) paymentsQuery = paymentsQuery.gte("payment_date", dateStart).lte("payment_date", dateEnd);
  const { data: payments, error: paymentsError } = await paymentsQuery;
  if (paymentsError) throwSupabaseError(paymentsError, "DATABASE_ERROR", "Unable to load payments.");

  let expensesQuery = supabase.from("expenses").select("amount, status").eq("organization_id", organizationId);
  if (dateStart && dateEnd) expensesQuery = expensesQuery.gte("expense_date", dateStart).lte("expense_date", dateEnd);
  const { data: expenses, error: expensesError } = await expensesQuery;
  if (expensesError) throwSupabaseError(expensesError, "DATABASE_ERROR", "Unable to load expenses.");

  const postedEntries = (journalEntries ?? []).filter((entry) => entry.status === "CONFIRMED");
  const confirmedPayments = (payments ?? []).filter((payment) => payment.status === "CONFIRMED");
  const confirmedExpenses = (expenses ?? []).filter((expense) => expense.status === "CONFIRMED");

  return {
    accounts: accounts ?? [],
    periods: periods ?? [],
    openPeriod,
    metrics: {
      activeAccounts: (accounts ?? []).filter((account) => account.is_active).length,
      totalAccounts: (accounts ?? []).length,
      openPeriods: (periods ?? []).filter((period) => period.status === "OPEN").length,
      postedJournalEntries: postedEntries.length,
      debitTotal: (accountTransactions ?? []).reduce((sum, row) => sum + Number(row.debit ?? 0), 0),
      creditTotal: (accountTransactions ?? []).reduce((sum, row) => sum + Number(row.credit ?? 0), 0),
      confirmedPayments: confirmedPayments.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
      confirmedExpenses: confirmedExpenses.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    },
    recentJournalEntries: (journalEntries ?? []).slice(0, 8),
  };
}
