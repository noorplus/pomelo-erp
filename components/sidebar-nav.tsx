"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Overview", items: [
    { href: "/", label: "Dashboard", icon: "▥" },
    { href: "/reports", label: "Reports", icon: "▤" },
  ]},
  { label: "Operations", items: [
    { href: "/sales", label: "Sales", icon: "↗" },
    { href: "/purchases", label: "Purchases", icon: "↙" },
    { href: "/inventory", label: "Inventory", icon: "▤" },
  ]},
  { label: "Finance", items: [
    { href: "/accounting", label: "Accounting", icon: "◎" },
    { href: "/payments", label: "Payments", icon: "৳" },
    { href: "/expenses", label: "Expenses", icon: "−" },
  ]},
  { label: "Masters", items: [
    { href: "/products", label: "Products", icon: "▦" },
    { href: "/contacts", label: "Contacts", icon: "◎" },
  ]},
  { label: "System", items: [
    { href: "/settings", label: "Settings", icon: "⚙" },
  ]},
];

export function SidebarNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="main-nav" aria-label="Main navigation">
      {navigation.map((section) => (
        <div className="nav-section" key={section.label}>
          <p className="nav-heading">{section.label}</p>
          {section.items.map((item) => {
            const active = item.href === "/"
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
