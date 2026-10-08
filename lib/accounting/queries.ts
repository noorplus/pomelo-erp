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


export async function listAccountingOptions(supabase: TypedSupabaseClient, organizationId: string) {
  const [accounts, contacts, periods, categories] = await Promise.all([
    supabase.from("accounts").select("id,account_code,account_name,account_type,is_active,is_postable").eq("organization_id", organizationId).order("account_code"),
    supabase.from("contacts").select("id,contact_number,name,is_active").eq("organization_id", organizationId).order("name"),
    supabase.from("accounting_periods").select("id,name,start_date,end_date,status").eq("organization_id", organizationId).order("start_date",{ascending:false}),
    supabase.from("expense_categories").select("id,category_code,name,expense_account_id,is_active").eq("organization_id", organizationId).order("category_code")
  ]);
  if(accounts.error) throwSupabaseError(accounts.error,"DATABASE_ERROR","Unable to load account options.");
  if(contacts.error) throwSupabaseError(contacts.error,"DATABASE_ERROR","Unable to load contact options.");
  if(periods.error) throwSupabaseError(periods.error,"DATABASE_ERROR","Unable to load accounting periods.");
  if(categories.error) throwSupabaseError(categories.error,"DATABASE_ERROR","Unable to load expense categories.");
  return {accounts:accounts.data,contacts:contacts.data,periods:periods.data,categories:categories.data};
}
export async function listJournalEntries(supabase: TypedSupabaseClient, organizationId: string) {
  const {data,error}=await supabase.from("journal_entries").select("*").eq("organization_id",organizationId).order("entry_date",{ascending:false});
  if(error) throwSupabaseError(error,"DATABASE_ERROR","Unable to load journal entries."); return data;
}
export async function getJournalEntry(supabase: TypedSupabaseClient, organizationId: string, id: string) {
  const [h,l]=await Promise.all([
    supabase.from("journal_entries").select("*").eq("organization_id",organizationId).eq("id",id).single(),
    supabase.from("account_transactions").select("*").eq("organization_id",organizationId).eq("journal_entry_id",id).order("line_number")
  ]);
  if(h.error) throwSupabaseError(h.error,"DATABASE_ERROR","Unable to load journal entry.");
  if(l.error) throwSupabaseError(l.error,"DATABASE_ERROR","Unable to load journal entry lines.");
  return {header:h.data,lines:l.data};
}
export async function listPayments(supabase: TypedSupabaseClient, organizationId: string) {
  const {data,error}=await supabase.from("payments").select("*").eq("organization_id",organizationId).order("payment_date",{ascending:false});
  if(error) throwSupabaseError(error,"DATABASE_ERROR","Unable to load payments."); return data;
}
export async function getPayment(supabase: TypedSupabaseClient, organizationId: string, id: string) {
  const [p,a]=await Promise.all([
    supabase.from("payments").select("*").eq("organization_id",organizationId).eq("id",id).single(),
    supabase.from("payment_allocations").select("*").eq("organization_id",organizationId).eq("payment_id",id)
  ]);
  if(p.error) throwSupabaseError(p.error,"DATABASE_ERROR","Unable to load payment.");
  if(a.error) throwSupabaseError(a.error,"DATABASE_ERROR","Unable to load payment allocations.");
  return {payment:p.data,allocations:a.data};
}
export async function listExpenses(supabase: TypedSupabaseClient, organizationId: string) {
  const {data,error}=await supabase.from("expenses").select("*").eq("organization_id",organizationId).order("expense_date",{ascending:false});
  if(error) throwSupabaseError(error,"DATABASE_ERROR","Unable to load expenses."); return data;
}
export async function listAccountLedger(supabase: TypedSupabaseClient, organizationId: string, accountId: string) {
  const {data,error}=await supabase.from("account_transactions").select("*").eq("organization_id",organizationId).eq("account_id",accountId).order("created_at",{ascending:false});
  if(error) throwSupabaseError(error,"DATABASE_ERROR","Unable to load account ledger."); return data;
}


export async function getFinancialReportData(supabase: TypedSupabaseClient, organizationId: string) {
  const [a,t]=await Promise.all([
    supabase.from("accounts").select("id,account_code,account_name,account_type,normal_balance,is_control_account,is_active").eq("organization_id",organizationId).order("account_code"),
    supabase.from("account_transactions").select("account_id,debit,credit").eq("organization_id",organizationId)
  ]);
  if(a.error) throwSupabaseError(a.error,"DATABASE_ERROR","Unable to load accounts for financial reports.");
  if(t.error) throwSupabaseError(t.error,"DATABASE_ERROR","Unable to load account transactions for financial reports.");
  const totals=new Map<string,{debit:number;credit:number}>();
  for(const row of t.data){const x=totals.get(row.account_id)||{debit:0,credit:0};x.debit+=Number(row.debit);x.credit+=Number(row.credit);totals.set(row.account_id,x);}
  return a.data.map(account=>{const x=totals.get(account.id)||{debit:0,credit:0};return {...account,debit:x.debit,credit:x.credit,balance:account.normal_balance==="DEBIT"?x.debit-x.credit:x.credit-x.debit};});
}
