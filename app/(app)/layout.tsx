import { OrganizationProvider } from "@/components/app/organization-provider";
import { AppShell } from "@/components/app/app-shell";
import { getApplicationContext } from "@/lib/organizations/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const applicationContext = await getApplicationContext();

  return (
    <OrganizationProvider initialContext={applicationContext}>
      <AppShell>{children}</AppShell>
    </OrganizationProvider>
  );
}
