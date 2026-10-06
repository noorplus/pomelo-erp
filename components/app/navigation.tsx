"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, X } from "lucide-react";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
];

export function Navigation({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen ? (
        <button aria-label="Close navigation" className="navigation-overlay" type="button" onClick={onMobileClose} />
      ) : null}
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
