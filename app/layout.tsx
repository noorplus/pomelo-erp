import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pomelo ERP",
  description: "Business management and accounting platform",
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