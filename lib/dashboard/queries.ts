import type { TypedSupabaseClient } from "@/lib/app/supabase";
import { throwSupabaseError } from "@/lib/app/errors";

type DashboardActivity = {
  id: string;
  kind: "sale" | "purchase" | "sales-return" | "purchase-return" | "payment" | "expense" | "journal";
  label: string;
  date: string;
  amount: number | null;
  href: string;
};

function dateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return { year: Number(part("year")), month: Number(part("month")), day: Number(part("day")) };
}

function monthStart(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
}

export async function getDashboardData(
  supabase: TypedSupabaseClient,
  organizationId: string,
  currency = "BDT",
  timeZone = "Asia/Dhaka",
) {
  const todayParts = dateInTimeZone(new Date(), timeZone);
  const today = `${todayParts.year}-${String(todayParts.month).padStart(2, "0")}-${String(todayParts.day).padStart(2, "0")}`;
  const currentMonthStart = monthStart(todayParts.year, todayParts.month);
  const nextMonthStart = monthStart(todayParts.year, todayParts.month + 1);
  const trendMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(todayParts.year, todayParts.month - 1 - (5 - index), 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    return {
      key: `${year}-${String(month).padStart(2, "0")}`,
      start: monthStart(year, month),
      next: monthStart(year, month + 1),
      label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date),
    };
  });
  const trendStart = trendMonths[0].start;

  const [
    salesResult,
    salesReturnsResult,
    purchasesResult,
    purchaseReturnsResult,
    inventoryResult,
    contactsCount,
    productsCount,
    accountsCount,
    periodsResult,
    salesDraftCount,
    purchaseDraftCount,
    paymentDraftCount,
    expenseDraftCount,
    recentSalesResult,
    recentPurchasesResult,
    recentSalesReturnsResult,
    recentPurchaseReturnsResult,
    recentPaymentsResult,
    recentExpensesResult,
    recentJournalsResult,
  ] = await Promise.all([
    supabase.from("sales").select("id,invoice_id,invoice_date,total_amount,status").eq("organization_id", organizationId).eq("status", "CONFIRMED").gte("invoice_date", trendStart).lte("invoice_date", today).order("invoice_date", { ascending: false }),
    supabase.from("sales_returns").select("id,return_number,return_date,total_amount,status").eq("organization_id", organizationId).eq("status", "CONFIRMED").gte("return_date", trendStart).lte("return_date", today).order("return_date", { ascending: false }),
    supabase.from("purchase").select("id,invoice_id,invoice_date,total_amount,status").eq("organization_id", organizationId).eq("status", "CONFIRMED").gte("invoice_date", trendStart).lte("invoice_date", today).order("invoice_date", { ascending: false }),
    supabase.from("purchase_returns").select("id,return_number,return_date,total_amount,status").eq("organization_id", organizationId).eq("status", "CONFIRMED").gte("return_date", trendStart).lte("return_date", today).order("return_date", { ascending: false }),
    supabase.from("inventory_balances").select("product_id,quantity,inventory_value").eq("organization_id", organizationId),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("accounting_periods").select("id,name,start_date,end_date,status").eq("organization_id", organizationId).order("start_date", { ascending: false }),
    supabase.from("sales").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "DRAFT"),
    supabase.from("purchase").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "DRAFT"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "DRAFT"),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "DRAFT"),
    supabase.from("sales").select("id,invoice_id,invoice_date,total_amount,status").eq("organization_id", organizationId).eq("status", "CONFIRMED").order("invoice_date", { ascending: false }).limit(5),
    supabase.from("purchase").select("id,invoice_id,invoice_date,total_amount,status").eq("organization_id", organizationId).eq("status", "CONFIRMED").order("invoice_date", { ascending: false }).limit(5),
    supabase.from("sales_returns").select("id,return_number,return_date,total_amount,status").eq("organization_id", organizationId).eq("status", "CONFIRMED").order("return_date", { ascending: false }).limit(5),
    supabase.from("purchase_returns").select("id,return_number,return_date,total_amount,status").eq("organization_id", organizationId).eq("status", "CONFIRMED").order("return_date", { ascending: false }).limit(5),
    supabase.from("payments").select("id,payment_number,payment_date,payment_type,amount,status").eq("organization_id", organizationId).eq("status", "CONFIRMED").order("payment_date", { ascending: false }).limit(5),
    supabase.from("expenses").select("id,expense_number,expense_date,amount,status").eq("organization_id", organizationId).eq("status", "CONFIRMED").order("expense_date", { ascending: false }).limit(5),
    supabase.from("journal_entries").select("id,entry_number,entry_date,entry_type,status,description").eq("organization_id", organizationId).eq("status", "CONFIRMED").order("entry_date", { ascending: false }).limit(5),
  ]);

  const errors = [
    salesResult.error, salesReturnsResult.error, purchasesResult.error, purchaseReturnsResult.error,
    inventoryResult.error, contactsCount.error, productsCount.error, accountsCount.error,
    periodsResult.error, salesDraftCount.error, purchaseDraftCount.error, paymentDraftCount.error,
    expenseDraftCount.error, recentSalesResult.error, recentPurchasesResult.error,
    recentSalesReturnsResult.error, recentPurchaseReturnsResult.error, recentPaymentsResult.error,
    recentExpensesResult.error, recentJournalsResult.error,
  ];
  const firstError = errors.find(Boolean);
  if (firstError) throwSupabaseError(firstError, "DATABASE_ERROR", "Unable to load the dashboard.");

  const sales = salesResult.data ?? [];
  const salesReturns = salesReturnsResult.data ?? [];
  const purchases = purchasesResult.data ?? [];
  const purchaseReturns = purchaseReturnsResult.data ?? [];
  const sum = (rows: Array<{ total_amount: number | string }>) =>
    rows.reduce((total, row) => total + Number(row.total_amount ?? 0), 0);
  const salesForMonth = sales.filter((row) => row.invoice_date >= currentMonthStart && row.invoice_date < nextMonthStart);
  const salesReturnsForMonth = salesReturns.filter((row) => row.return_date >= currentMonthStart && row.return_date < nextMonthStart);
  const purchasesForMonth = purchases.filter((row) => row.invoice_date >= currentMonthStart && row.invoice_date < nextMonthStart);
  const purchaseReturnsForMonth = purchaseReturns.filter((row) => row.return_date >= currentMonthStart && row.return_date < nextMonthStart);

  const trend = trendMonths.map((month) => {
    const monthSales = sales.filter((row) => row.invoice_date >= month.start && row.invoice_date < month.next);
    const monthSalesReturns = salesReturns.filter((row) => row.return_date >= month.start && row.return_date < month.next);
    const monthPurchases = purchases.filter((row) => row.invoice_date >= month.start && row.invoice_date < month.next);
    const monthPurchaseReturns = purchaseReturns.filter((row) => row.return_date >= month.start && row.return_date < month.next);
    return {
      key: month.key,
      label: month.label,
      sales: sum(monthSales) - sum(monthSalesReturns),
      purchases: sum(monthPurchases) - sum(monthPurchaseReturns),
    };
  });

  const activity: DashboardActivity[] = [
    ...(recentSalesResult.data ?? []).map((row) => ({
      id: `sale-${row.id}`, kind: "sale" as const, label: row.invoice_id ?? "Sales invoice",
      date: row.invoice_date, amount: Number(row.total_amount), href: `/sales/invoices/${row.id}`,
    })),
    ...(recentPurchasesResult.data ?? []).map((row) => ({
      id: `purchase-${row.id}`, kind: "purchase" as const, label: row.invoice_id ?? "Purchase invoice",
      date: row.invoice_date, amount: Number(row.total_amount), href: `/purchase/invoices/${row.id}`,
    })),
    ...(recentSalesReturnsResult.data ?? []).map((row) => ({
      id: `sales-return-${row.id}`, kind: "sales-return" as const, label: row.return_number ?? "Sales return",
      date: row.return_date, amount: -Number(row.total_amount), href: `/sales/returns/${row.id}`,
    })),
    ...(recentPurchaseReturnsResult.data ?? []).map((row) => ({
      id: `purchase-return-${row.id}`, kind: "purchase-return" as const, label: row.return_number ?? "Purchase return",
      date: row.return_date, amount: -Number(row.total_amount), href: `/purchase/returns/${row.id}`,
    })),
    ...(recentPaymentsResult.data ?? []).map((row) => ({
      id: `payment-${row.id}`, kind: "payment" as const, label: row.payment_number ?? (row.payment_type === "RECEIPT" ? "Receipt" : "Payment"),
      date: row.payment_date, amount: row.payment_type === "PAYMENT" ? -Number(row.amount) : Number(row.amount),
      href: `/accounting/transactions/payments/${row.id}`,
    })),
    ...(recentExpensesResult.data ?? []).map((row) => ({
      id: `expense-${row.id}`, kind: "expense" as const, label: row.expense_number ?? "Expense",
      date: row.expense_date, amount: -Number(row.amount), href: "/accounting/transactions/expenses",
    })),
    ...(recentJournalsResult.data ?? []).map((row) => ({
      id: `journal-${row.id}`, kind: "journal" as const,
      label: row.entry_number ?? row.description ?? "Journal entry", date: row.entry_date,
      amount: null, href: `/accounting/transactions/journal-entries/${row.id}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return {
    currency,
    today,
    currentMonthStart,
    metrics: {
      netSales: sum(salesForMonth) - sum(salesReturnsForMonth),
      netPurchases: sum(purchasesForMonth) - sum(purchaseReturnsForMonth),
      inventoryValue: (inventoryResult.data ?? []).reduce((total, row) => total + Number(row.inventory_value ?? 0), 0),
      activeProducts: productsCount.count ?? 0,
      activeContacts: contactsCount.count ?? 0,
      activeAccounts: accountsCount.count ?? 0,
      openPeriods: (periodsResult.data ?? []).filter((period) => period.status === "OPEN").length,
      openDrafts: (salesDraftCount.count ?? 0) + (purchaseDraftCount.count ?? 0) + (paymentDraftCount.count ?? 0) + (expenseDraftCount.count ?? 0),
    },
    periods: periodsResult.data ?? [],
    trend,
    recentActivity: activity,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
