import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pomelo ERP",
  description:
    "A modern ERP platform for inventory and business management with double-entry accounting, sales, purchases, payments, expenses, AR/AP, and financial reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
