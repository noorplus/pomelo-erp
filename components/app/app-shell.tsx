"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/app/header";
import { Navigation } from "@/components/app/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    if (!navigationOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavigationOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigationOpen]);

  return (
    <div className="app-shell">
      <Header onMenuClick={() => setNavigationOpen(true)} />
      <div className="app-body">
        <Navigation
          mobileOpen={navigationOpen}
          onMobileClose={() => setNavigationOpen(false)}
        />
        <main className="main-container">{children}</main>
      </div>
    </div>
  );
}
