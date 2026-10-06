"use client";

import Link from "next/link";
import { useOrganizationContext } from "@/components/app/organization-provider";
import { OrganizationOnboarding } from "@/components/app/organization-onboarding";
import { PageHeader, PageSection } from "@/components/ui";

export default function DashboardPage() {
  const { activeOrganization, organizationState } = useOrganizationContext();
  if (organizationState === "no-organization") return <OrganizationOnboarding />;
  return <section className="page"><PageHeader eyebrow="Overview" title="Dashboard" description={activeOrganization ? `Workspace: ${activeOrganization.name}` : undefined} actions={<Link className="button" href="/organization-settings">Organization settings</Link>} /><PageSection title="Workspace"><div className="content-card"><p className="eyebrow">Organization</p><h2>{activeOrganization?.name}</h2><p className="lede">Your organization workspace is connected to the frozen database through the typed application context.</p></div></PageSection></section>;
}