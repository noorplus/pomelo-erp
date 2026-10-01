"use client";

import { useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { SidebarNav } from "@/components/sidebar-nav";

type Organization = { id: string; name: string; role: "owner" | "admin" | "manager" | "staff" };
type User = { email?: string | null };

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const email = user?.email || "Signed in";
  const initial = (email[0] || "U").toUpperCase();

  return (
    <div className="erp-shell">
      <aside className="sidebar desktop-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">P</div>
          <div><strong>Pomelo ERP</strong><span>{organization.name}</span></div>
        </div>
        <SidebarNav onNavigate={() => undefined} />
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
        <SidebarNav onNavigate={() => setMobileOpen(false)} />
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

          <div className="topbar-actions">
            <div className="topbar-status"><span /> Connected</div>
            <div className="user-menu-wrap">
              <button
                className={userMenuOpen ? "user-menu-trigger open" : "user-menu-trigger"}
                type="button"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((value) => !value)}
              >
                <span className="avatar">{initial}</span>
                <span className="user-menu-copy">
                  <strong>{email}</strong>
                  <span>{organization.role}</span>
                </span>
                <span className="user-menu-chevron" aria-hidden="true">⌄</span>
              </button>
              {userMenuOpen && (
                <>
                  <button className="user-menu-backdrop" aria-label="Close user menu" onClick={() => setUserMenuOpen(false)} />
                  <div className="user-menu-dropdown" role="menu">
                    <div className="user-menu-header">
                      <span className="avatar large">{initial}</span>
                      <div>
                        <strong>{email}</strong>
                        <span>{organization.role}</span>
                      </div>
                    </div>
                    <div className="user-menu-divider" />
                    <div className="user-menu-action">
                      <SignOutButton />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
