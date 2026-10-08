"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Contact,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/administration", label: "Administration", icon: Settings },
  { href: "/contacts", label: "Contacts", icon: Contact },
  { href: "/master-data", label: "Master data", icon: Package },
  { href: "/products", label: "Products", icon: Package },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
];

const accountingNavigation = [
  { href: "/accounting/accounts", label: "Chart of Accounts", icon: BookOpen },
  { href: "/accounting/ledger", label: "Account Ledger", icon: FileText },
  { href: "/accounting/transactions/journal-entries", label: "Journal Entries", icon: FileText },
  { href: "/accounting/transactions/payments", label: "Payments", icon: Wallet },
  { href: "/accounting/transactions/expenses", label: "Expenses", icon: Receipt },
  { href: "/accounting/periods", label: "Periods", icon: CalendarDays },
  { href: "/accounting/receivables-payables", label: "Receivables & Payables", icon: Wallet },
  { href: "/accounting/reports/trial-balance", label: "Trial Balance", icon: FileText },
  { href: "/accounting/reports/profit-loss", label: "Profit & Loss", icon: FileText },
  { href: "/accounting/reports/balance-sheet", label: "Balance Sheet", icon: FileText },
];

export function Navigation({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const accountingActive = pathname === "/accounting" || pathname.startsWith("/accounting/");
  const [accountingOpen, setAccountingOpen] = useState(accountingActive);

  return (
    <>
      {mobileOpen ? <button aria-label="Close navigation" className="navigation-overlay" type="button" onClick={onMobileClose} /> : null}
      <aside aria-label="Application navigation" className={mobileOpen ? "navigation navigation-open" : "navigation"}>
        <div className="navigation-header">
          <span>Navigation</span>
          <button aria-label="Close navigation" className="navigation-close" type="button" onClick={onMobileClose}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <nav aria-label="Primary navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
            return (
              <Link key={href} aria-current={active ? "page" : undefined} className={active ? "navigation-link navigation-link-active" : "navigation-link"} href={href} onClick={onMobileClose}>
                <Icon size={18} strokeWidth={2} />
                <span>{label}</span>
              </Link>
            );
          })}

          <section className="navigation-group">
            <button
              type="button"
              className={accountingActive ? "navigation-link navigation-group-toggle navigation-link-active" : "navigation-link navigation-group-toggle"}
              aria-expanded={accountingOpen}
              onClick={() => setAccountingOpen((open) => !open)}
            >
              <BookOpen size={18} strokeWidth={2} />
              <span>Accounting</span>
              <ChevronDown className={accountingOpen ? "navigation-chevron navigation-chevron-open" : "navigation-chevron"} size={16} strokeWidth={2} />
            </button>

            {accountingOpen ? (
              <div className="navigation-submenu">
                <Link
                  aria-current={pathname === "/accounting" ? "page" : undefined}
                  className={pathname === "/accounting" ? "navigation-sublink navigation-sublink-active" : "navigation-sublink"}
                  href="/accounting"
                  onClick={onMobileClose}
                >
                  <LayoutDashboard size={15} strokeWidth={2} />
                  <span>Dashboard</span>
                </Link>
                {accountingNavigation.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link key={href} aria-current={active ? "page" : undefined} className={active ? "navigation-sublink navigation-sublink-active" : "navigation-sublink"} href={href} onClick={onMobileClose}>
                      <Icon size={15} strokeWidth={2} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>
        </nav>
      </aside>
    </>
  );
}
