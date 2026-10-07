import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { getApplicationContext } from "@/lib/organizations/server";
import { listOrganizationMembers } from "@/lib/organizations/queries";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageSection, StatusBadge } from "@/components/ui";

export default async function AdministrationPage() {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;

  const members = await listOrganizationMembers(
    await createClient(),
    context.activeOrganization.id,
  );
  const activeMembers = members.filter((member) => member.is_active).length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Administration"
        title="Administration"
        description="Manage the organization and its active membership using only the frozen database capabilities."
      />

      <PageSection title="Organization">
        <div className="content-card">
          <div className="administration-card-icon"><Building2 size={18} /></div>
          <p className="eyebrow">Organization profile</p>
          <h2>{context.activeOrganization.name}</h2>
          <p className="lede">
            {context.activeOrganization.base_currency} · {context.activeOrganization.timezone}
          </p>
          <div className="actions">
            <Link className="button primary" href="/organization-settings">
              Manage organization
            </Link>
          </div>
        </div>
      </PageSection>

      <PageSection title="Users & membership">
        <div className="content-card">
          <div className="administration-card-icon"><Users size={18} /></div>
          <p className="eyebrow">Organization users</p>
          <h2>{activeMembers} active member{activeMembers === 1 ? "" : "s"}</h2>
          <p className="lede">
            Membership is controlled by the existing organization membership RPCs. No roles or permissions are invented at the application layer.
          </p>
          <div className="actions">
            <Link className="button" href="/organization-settings">
              Manage members
            </Link>
            <StatusBadge tone="success">Database-backed</StatusBadge>
          </div>
        </div>
      </PageSection>
    </div>
  );
}
