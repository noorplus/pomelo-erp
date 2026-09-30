import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { findCurrentOrganization } from "@/lib/supabase/organization";
import { redirect } from "next/navigation";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: "⌂" },
  { href: "/dashboard/products", label: "Products", icon: "▦" },
  { href: "/dashboard/sales", label: "Sales", icon: "↗" },
  { href: "/dashboard/purchases", label: "Purchases", icon: "↙" },
  { href: "/dashboard/inventory", label: "Inventory", icon: "▤" },
  { href: "/dashboard/accounting", label: "Accounting", icon: "◎" },
  { href: "/dashboard/payments", label: "Payments", icon: "৳" },
  { href: "/dashboard/expenses", label: "Expenses", icon: "−" },
  { href: "/dashboard/reports", label: "Reports", icon: "▥" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const organization = await findCurrentOrganization();

  if (!organization) redirect("/onboarding");

  return (
    <div className="erp-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">P</div>
          <div>
            <strong>Pomelo ERP</strong>
            <span>{organization.name}</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-heading">Workspace</p>
          {navigation.map((item) => (
            <Link className="nav-link" href={item.href} key={item.href}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <span className="avatar">{(user?.email?.[0] || "U").toUpperCase()}</span>
            <div className="user-meta">
              <strong>{user?.email || "Signed in"}</strong>
              <span>Authenticated user</span>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div>
            <p className="topbar-kicker">ERP workspace</p>
            <strong>{organization.name} · Operations & Finance</strong>
          </div>
          <div className="topbar-status"><span /> System connected</div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
