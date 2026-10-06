"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <button aria-label="Open navigation" className="menu-button" type="button" onClick={onMenuClick}>
          <Menu size={20} strokeWidth={2} />
        </button>
        <Link className="brand" href="/" aria-label="Pomelo ERP home">
          Pomelo ERP
        </Link>
      </div>
    </header>
  );
}