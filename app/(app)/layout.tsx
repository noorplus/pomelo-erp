import { AppShell } from "@/components/app/app-shell";

export default function ApplicationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}