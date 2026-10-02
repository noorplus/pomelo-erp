export type ErpModule = {
  key: string;
  label: string;
  description: string;
  href: string;
  capabilities: readonly string[];
};

export const ERP_MODULES: readonly ErpModule[] = [
  {
    key: "products",
    label: "Products",
    description: "Inventory-aware product master and account mappings.",
    href: "/products",
    capabilities: ["Product master", "UOM", "Inventory account", "Revenue account", "COGS account"],
  },
  {
    key: "contacts",
    label: "Contacts",
    description: "Unified customer and supplier master.",
    href: "/contacts",
    capabilities: ["Contact master", "Statements", "Sales relationship", "Purchase relationship"],
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Read-only stock state and immutable inventory history.",
    href: "/inventory",
    capabilities: ["Current balances", "Inventory valuation", "Movement ledger"],
  },
  {
    key: "purchasing",
    label: "Purchasing",
    description: "Purchase invoices, returns and transactional posting.",
    href: "/purchases",
    capabilities: ["Draft", "Post", "Purchase return", "Inventory receipt", "Payables"],
  },
  {
    key: "sales",
    label: "Sales",
    description: "Sales invoices, returns and historical COGS posting.",
    href: "/sales",
    capabilities: ["Draft", "Post", "Sales return", "COGS", "Receivables"],
  },
  {
    key: "accounting",
    label: "Accounting",
    description: "Double-entry accounting and journal lifecycle.",
    href: "/accounting",
    capabilities: ["Chart of accounts", "Periods", "Manual journals", "Reversals", "Ledger"],
  },
  {
    key: "expenses",
    label: "Expenses",
    description: "Expense categories and accounting-backed expense posting.",
    href: "/expenses",
    capabilities: ["Categories", "Expense entry", "Posting"],
  },
  {
    key: "payments",
    label: "Payments",
    description: "Receipts, payments, refunds and allocations.",
    href: "/payments",
    capabilities: ["Receipt", "Payment", "Refund in", "Refund out", "Allocation"],
  },
  {
    key: "reports",
    label: "Reports",
    description: "Ledger-derived operational and financial reporting.",
    href: "/reports",
    capabilities: ["Trial balance", "General ledger", "Inventory", "Sales", "Purchases", "Expenses"],
  },
] as const;
