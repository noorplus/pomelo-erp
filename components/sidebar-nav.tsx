"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { label: string; items: NavItem[] };

export const ERP_NAVIGATION: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: "▥" },
      { href: "/reports", label: "Reports", icon: "▤" },
    ],
  },
  {
    label: "Master Data",
    items: [
      { href: "/products", label: "Products", icon: "▦" },
      { href: "/contacts", label: "Contacts", icon: "◎" },
      { href: "/inventory/configuration/units", label: "Units", icon: "↔" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/inventory", label: "Stock & Ledger", icon: "▤" },
    ],
  },
  {
    label: "Purchasing",
    items: [
      { href: "/purchases", label: "Purchases & Returns", icon: "↙" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/sales", label: "Sales & Returns", icon: "↗" },
    ],
  },
  {
    label: "Accounting",
    items: [
      { href: "/accounting", label: "Accounting", icon: "◎" },
      { href: "/accounting/configuration/accounts", label: "Chart of Accounts", icon: "≡" },
      { href: "/accounting/configuration/periods", label: "Accounting Periods", icon: "◷" },
    ],
  },
  {
    label: "Expenses & Payments",
    items: [
      { href: "/expenses", label: "Expenses", icon: "−" },
      { href: "/expenses/configuration/categories", label: "Expense Categories", icon: "⊞" },
      { href: "/payments", label: "Payments & Refunds", icon: "৳" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings", label: "Settings", icon: "⚙" },
      { href: "/settings/organization", label: "Organization", icon: "□" },
      { href: "/settings/users", label: "Users & Roles", icon: "♙" },
      { href: "/settings/number-sequences", label: "Number Sequences", icon: "#" },
    ],
  },
];

export function SidebarNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="main-nav" aria-label="Main navigation">
      {ERP_NAVIGATION.map((section) => (
        <div className="nav-section" key={section.label}>
          <p className="nav-heading">{section.label}</p>
          {section.items.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                className={active ? "nav-link active" : "nav-link"}
                href={item.href}
                key={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
