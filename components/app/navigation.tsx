"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Boxes, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Contact, FileText, LayoutDashboard, Package, Receipt, Settings, ShoppingCart, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
const operations: NavItem[] = [
  { href: "/contacts", label: "Contacts", icon: Contact }, { href: "/products", label: "Products", icon: Package },
  { href: "/purchase", label: "Purchase", icon: ShoppingCart }, { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
];
const administration: NavItem[] = [
  { href: "/administration", label: "Administration", icon: Settings }, { href: "/master-data", label: "Master Data", icon: Package },
];
const accounting: NavItem[] = [
  { href: "/accounting", label: "Dashboard", icon: LayoutDashboard }, { href: "/accounting/accounts", label: "Chart of Accounts", icon: BookOpen },
  { href: "/accounting/opening-balance", label: "Opening Balance", icon: Wallet }, { href: "/accounting/ledger", label: "Account Ledger", icon: FileText },
  { href: "/accounting/transactions/journal-entries", label: "Journal Entries", icon: FileText }, { href: "/accounting/transactions/payments", label: "Payments", icon: Wallet },
  { href: "/accounting/transactions/expenses", label: "Expenses", icon: Receipt }, { href: "/accounting/periods", label: "Periods", icon: CalendarDays },
  { href: "/accounting/setup/expense-categories", label: "Expense Categories", icon: Receipt }, { href: "/accounting/receivables-payables", label: "Receivables & Payables", icon: Wallet },
  { href: "/accounting/reports/trial-balance", label: "Trial Balance", icon: FileText }, { href: "/accounting/reports/profit-loss", label: "Profit & Loss", icon: FileText },
  { href: "/accounting/reports/balance-sheet", label: "Balance Sheet", icon: FileText },
];
const activePath = (pathname: string, href: string) => pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

export function Navigation({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const accountingActive = pathname === "/accounting" || pathname.startsWith("/accounting/");
  const [accountingOpen, setAccountingOpen] = useState(accountingActive);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { try { setCollapsed(window.localStorage.getItem("pomelo.navigation.collapsed") === "true"); } catch {} }, []);
  useEffect(() => { if (accountingActive) setAccountingOpen(true); }, [accountingActive]);
  useEffect(() => { if (mobileOpen) setCollapsed(false); }, [mobileOpen]);

  const toggleCollapsed = () => setCollapsed(current => {
    const next = !current; try { window.localStorage.setItem("pomelo.navigation.collapsed", String(next)); } catch {} return next;
  });
  const itemClass = (active: boolean) => `navigation-link${active ? " navigation-link-active" : ""}`;
  const renderItems = (items: NavItem[]) => items.map(({ href, label, icon: Icon }) => {
    const active = activePath(pathname, href);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={itemClass(active)} onClick={onMobileClose} title={label}><Icon size={18} /><span>{label}</span></Link>;
  });

  return <>
    {mobileOpen && <button aria-label="Close navigation" className="navigation-overlay" type="button" onClick={onMobileClose} />}
    <aside aria-label="Application navigation" className={`navigation${collapsed ? " navigation-collapsed" : ""}${mobileOpen ? " navigation-open" : ""}`}>
      <div className="navigation-header"><span className="navigation-title">Navigation</span><div className="navigation-header-actions">
        <button aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"} className="navigation-collapse" type="button" onClick={toggleCollapsed}>{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        <button aria-label="Close navigation" className="navigation-close" type="button" onClick={onMobileClose}><X size={18} /></button>
      </div></div>

      <nav className="navigation-content">
        <div className="navigation-home"><Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={itemClass(pathname === "/")} onClick={onMobileClose} title="Dashboard"><LayoutDashboard size={18} /><span>Dashboard</span></Link></div>
        <section className="navigation-section"><div className="navigation-section-label">Operations</div>{renderItems(operations)}</section>
        <section className="navigation-section"><div className="navigation-section-label">Accounting</div>
          <button type="button" className={itemClass(accountingActive) + " navigation-group-toggle"} aria-expanded={accountingOpen} aria-controls="accounting-navigation" title="Accounting" onClick={() => {
            if (collapsed) { setCollapsed(false); try { window.localStorage.setItem("pomelo.navigation.collapsed", "false"); } catch {} }
            else setAccountingOpen(current => !current);
          }}><BookOpen size={18} /><span>Accounting</span><ChevronDown className={accountingOpen ? "navigation-chevron navigation-chevron-open" : "navigation-chevron"} size={16} /></button>
          {accountingOpen && <div id="accounting-navigation" className="navigation-submenu">{accounting.map(({ href, label, icon: Icon }) => {
            const active = activePath(pathname, href);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? "navigation-sublink navigation-sublink-active" : "navigation-sublink"} onClick={onMobileClose} title={label}><Icon size={15} /><span>{label}</span></Link>;
          })}</div>}
        </section>
        <section className="navigation-section"><div className="navigation-section-label">Administration</div>{renderItems(administration)}</section>
      </nav>
    </aside>
  </>;
}
