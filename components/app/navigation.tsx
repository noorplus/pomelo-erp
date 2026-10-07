"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ShoppingCart,
  Contact,
  LayoutDashboard,
  Package,
  Settings,
  X,
} from "lucide-react";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/administration", label: "Administration", icon: Settings },
  { href: "/contacts", label: "Contacts", icon: Contact },
  { href: "/accounting/accounts", label: "Chart of accounts", icon: BookOpen },
  { href: "/accounting/periods", label: "Accounting periods", icon: CalendarDays },
  { href: "/master-data", label: "Master data", icon: Package },
  { href: "/products", label: "Products", icon: Package },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
];

export function Navigation({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();

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
        </nav>
      </aside>
    </>
  );
}
