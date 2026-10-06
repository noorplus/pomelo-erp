"use client";

import { useOrganizationContext } from "@/components/app/organization-provider";

export default function DashboardPage() {
  const { activeOrganization } = useOrganizationContext();

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Dashboard</h1>
        </div>
      </div>
      <div className="content-card">
        {activeOrganization ? (
          <>
            <p className="eyebrow">Organization</p>
            <h2>{activeOrganization.name}</h2>
            <p className="lede">
              Your organization workspace is connected to the frozen database
              through the typed application context.
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">Organization</p>
            <h2>No organization available</h2>
            <p className="lede">
              Your account is authenticated, but it is not an active member of
              an organization yet.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
