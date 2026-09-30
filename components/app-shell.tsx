"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

type Organization = { id: string; name: string; role: "owner" | "admin" | "manager" | "staff" };
type User = { email?: string | null };

const navigation = [
  { href: "/", label: "Dashboard", icon: "▥" },
  { href: "/products", label: "Products", icon: "▦" },
  { href: "/contacts", label: "Contacts", icon: "◎" },
  { href: "/sales", label: "Sales", icon: "↗" },
  { href: "/purchases", label: "Purchases", icon: "↙" },
  { href: "/inventory", label: "Inventory", icon: "▤" },
  { href: "/accounting", label: "Accounting", icon: "◎" },
  { href: "/payments", label: "Payments", icon: "৳" },
  { href: "/expenses", label: "Expenses", icon: "−" },
  { href: "/reports", label: "Reports", icon: "▥" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

function Navigation({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="main-nav" aria-label="Main navigation">
      <p className="nav-heading">Workspace</p>
      {navigation.map((item) => {
        const active = item.href === "/dashboard"
          ? pathname === item.href
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
    </nav>
  );
}

export function AppShell({
  children,
  organization,
  user,
}: {
  children: React.ReactNode;
  organization: Organization;
  user: User | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="erp-shell">
      <aside className="sidebar desktop-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">P</div>
          <div><strong>Pomelo ERP</strong><span>{organization.name}</span></div>
        </div>
        <Navigation onNavigate={() => undefined} />
        <div className="sidebar-footer">
          <div className="user-card">
            <span className="avatar">{(user?.email?.[0] || "U").toUpperCase()}</span>
            <div className="user-meta"><strong>{user?.email || "Signed in"}</strong><span>{organization.role}</span></div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {mobileOpen && (
        <button className="mobile-nav-overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={mobileOpen ? "sidebar mobile-sidebar open" : "sidebar mobile-sidebar"} aria-hidden={!mobileOpen}>
        <div className="sidebar-brand">
          <div className="brand-mark small">P</div>
          <div><strong>Pomelo ERP</strong><span>{organization.name}</span></div>
          <button className="mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>×</button>
        </div>
        <Navigation onNavigate={() => setMobileOpen(false)} />
        <div className="sidebar-footer">
          <div className="user-card">
            <span className="avatar">{(user?.email?.[0] || "U").toUpperCase()}</span>
            <div className="user-meta"><strong>{user?.email || "Signed in"}</strong><span>{organization.role}</span></div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="mobile-header-left">
            <button className="hamburger-button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
              <span /><span /><span />
            </button>
            <div className="mobile-brand-mark">P</div>
          </div>
          <div className="topbar-context">
            <p className="topbar-kicker">Pomelo ERP</p>
            <strong>{organization.name}</strong>
          </div>
          <div className="topbar-status"><span /> Connected</div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
