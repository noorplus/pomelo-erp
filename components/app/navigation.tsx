"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  BookOpen, Boxes, CalendarDays, ChevronDown, ChevronLeft, ChevronRight,
  Contact, FileText, LayoutDashboard, Package, Receipt, Settings, ShoppingCart, Wallet, X,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; matchChildren?: boolean };
type NavModule = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  matchPaths: string[];
  items: NavItem[];
};

const modules: { section: string; modules: NavModule[] }[] = [
  { section: "Operations", modules: [
    { id: "contacts", label: "Contacts", icon: Contact, matchPaths: ["/contacts"], items: [
      { href: "/contacts", label: "All Contacts", icon: Contact, matchChildren: true },
      { href: "/contacts/new", label: "New Contact", icon: Contact },
    ]},
    { id: "products", label: "Products", icon: Package, matchPaths: ["/products"], items: [
      { href: "/products", label: "All Products", icon: Package, matchChildren: true },
      { href: "/products/new", label: "New Product", icon: Package },
    ]},
    { id: "sales", label: "Sales", icon: ShoppingCart, matchPaths: ["/sales"], items: [
      { href: "/sales", label: "Sales Overview", icon: LayoutDashboard },
      { href: "/sales/invoices", label: "Invoices", icon: FileText, matchChildren: true },
      { href: "/sales/invoices/new", label: "New Invoice", icon: Receipt },
      { href: "/sales/returns", label: "Sales Returns", icon: Receipt, matchChildren: true },
      { href: "/sales/returns/new", label: "New Sales Return", icon: Receipt },
    ]},
    { id: "purchase", label: "Purchase", icon: ShoppingCart, matchPaths: ["/purchase"], items: [
      { href: "/purchase", label: "Purchase Overview", icon: LayoutDashboard },
      { href: "/purchase/invoices", label: "Purchase Invoices", icon: FileText, matchChildren: true },
      { href: "/purchase/invoices/new", label: "New Purchase Invoice", icon: Receipt },
      { href: "/purchase/returns", label: "Purchase Returns", icon: Receipt, matchChildren: true },
      { href: "/purchase/returns/new", label: "New Purchase Return", icon: Receipt },
    ]},
    { id: "inventory", label: "Inventory", icon: Boxes, matchPaths: ["/inventory"], items: [
      { href: "/inventory", label: "Inventory Overview", icon: LayoutDashboard },
      { href: "/inventory/stock", label: "Stock", icon: Boxes },
      { href: "/inventory/transactions", label: "Inventory Transactions", icon: FileText },
    ]},
  ]},
  { section: "Finance", modules: [
    { id: "accounting", label: "Accounting", icon: BookOpen, matchPaths: ["/accounting"], items: [
      { href: "/accounting", label: "Accounting Overview", icon: LayoutDashboard },
      { href: "/accounting/accounts", label: "Chart of Accounts", icon: BookOpen },
      { href: "/accounting/ledger", label: "Account Ledger", icon: FileText },
      { href: "/accounting/opening-balance", label: "Opening Balance", icon: Wallet },
      { href: "/accounting/periods", label: "Accounting Periods", icon: CalendarDays },
      { href: "/accounting/receivables-payables", label: "Receivables & Payables", icon: Wallet },
      { href: "/accounting/reports/trial-balance", label: "Trial Balance", icon: FileText },
      { href: "/accounting/reports/profit-loss", label: "Profit & Loss", icon: FileText },
      { href: "/accounting/reports/balance-sheet", label: "Balance Sheet", icon: FileText },
      { href: "/accounting/setup/expense-categories", label: "Expense Categories", icon: Receipt },
      { href: "/accounting/transactions/expenses", label: "Expenses", icon: Receipt },
      { href: "/accounting/transactions/journal-entries", label: "Journal Entries", icon: FileText, matchChildren: true },
      { href: "/accounting/transactions/payments", label: "Payments", icon: Wallet, matchChildren: true },
    ]},
  ]},
  { section: "System", modules: [
    { id: "administration", label: "Administration", icon: Settings, matchPaths: ["/administration", "/master-data"], items: [
      { href: "/administration", label: "Administration Overview", icon: Settings },
      { href: "/master-data", label: "Master Data", icon: Package },
    ]},
  ]},
];

const activePath = (pathname: string, href: string) =>
  pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
const moduleIsActive = (pathname: string, item: NavModule) =>
  item.matchPaths.some((path) => activePath(pathname, path));
const navItemIsActive = (pathname: string, item: NavItem) =>
  pathname === item.href ||
  Boolean(item.matchChildren && pathname.startsWith(item.href + "/") && pathname !== item.href + "/new");

const storageSubscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("pomelo-navigation", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("pomelo-navigation", callback);
  };
};
const storageSnapshot = () => {
  try { return window.localStorage.getItem("pomelo.navigation.collapsed") === "true"; }
  catch { return false; }
};
const storageServerSnapshot = () => false;

export function Navigation({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const activeModule = modules.flatMap((section) => section.modules).find((item) => moduleIsActive(pathname, item));
  const [expandedModule, setExpandedModule] = useState(activeModule?.id ?? "");
  const collapsed = useSyncExternalStore(storageSubscribe, storageSnapshot, storageServerSnapshot);

  useEffect(() => {
    if (activeModule) setExpandedModule(activeModule.id);
  }, [activeModule?.id, pathname]);

  const setCollapsed = (value: boolean) => {
    try {
      window.localStorage.setItem("pomelo.navigation.collapsed", String(value));
      window.dispatchEvent(new Event("pomelo-navigation"));
    } catch { /* Keep navigation usable when storage is unavailable. */ }
  };
  const itemClass = (active: boolean) => `navigation-link${active ? " navigation-link-active" : ""}`;

  const renderModule = (item: NavModule) => {
    const Icon = item.icon;
    const active = moduleIsActive(pathname, item);
    const expanded = expandedModule === item.id;
    const submenuId = `${item.id}-navigation`;
    return (
      <div className="navigation-module" key={item.id}>
        <button
          type="button"
          className={`${itemClass(active)} navigation-group-toggle`}
          aria-expanded={!collapsed && expanded}
          aria-controls={submenuId}
          title={item.label}
          onClick={() => {
            if (collapsed) {
              setCollapsed(false);
              setExpandedModule(item.id);
              return;
            }
            setExpandedModule((current) => current === item.id ? "" : item.id);
          }}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{item.label}</span>
          <ChevronDown size={15} aria-hidden="true" className={expanded ? "navigation-chevron navigation-chevron-open" : "navigation-chevron"} />
        </button>
        {!collapsed && expanded && (
          <div id={submenuId} className="navigation-submenu">
            {item.items.map(({ href, label, icon: ItemIcon, ...navOptions }) => {
              const selected = navItemIsActive(pathname, { href, label, icon: ItemIcon, ...navOptions });
              return (
                <Link key={href} href={href} aria-current={selected ? "page" : undefined}
                  className={selected ? "navigation-sublink navigation-sublink-active" : "navigation-sublink"}
                  onClick={onMobileClose} title={label}>
                  <ItemIcon size={15} aria-hidden="true" /><span>{label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" className="navigation-overlay" type="button" onClick={onMobileClose} />}
      <aside aria-label="Application navigation" className={`navigation${collapsed ? " navigation-collapsed" : ""}${mobileOpen ? " navigation-open" : ""}`}>
        <div className="navigation-header">
          <span className="navigation-title">Navigation</span>
          <div className="navigation-header-actions">
            <button aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"}
              className="navigation-collapse" type="button" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            </button>
            <button aria-label="Close navigation" className="navigation-close" type="button" onClick={onMobileClose}><X size={18} /></button>
          </div>
        </div>
        <nav className="navigation-content" aria-label="Main menu">
          <div className="navigation-home">
            <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={itemClass(pathname === "/")} onClick={onMobileClose} title="Dashboard">
              <LayoutDashboard size={18} aria-hidden="true" /><span>Dashboard</span>
            </Link>
          </div>
          {modules.map((section) => (
            <section className="navigation-section" key={section.section} aria-label={section.section}>
              <div className="navigation-section-label">{section.section}</div>
              {section.modules.map(renderModule)}
            </section>
          ))}
        </nav>
      </aside>
    </>
  );
}
