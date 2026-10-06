"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ApplicationContext, Organization } from "@/lib/app/types";

type OrganizationContextValue = ApplicationContext & {
  organizationState: "ready" | "no-organization";
  setActiveOrganization: (organizationId: string) => void;
};

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({
  initialContext,
  children,
}: {
  initialContext: ApplicationContext;
  children: React.ReactNode;
}) {
  const [activeOrganizationId, setActiveOrganizationId] = useState(
    initialContext.activeOrganization?.id ?? null,
  );

  const value = useMemo<OrganizationContextValue>(() => {
    const activeOrganization =
      initialContext.organizations.find(
        (organization) => organization.id === activeOrganizationId,
      ) ?? null;

    return {
      ...initialContext,
      activeOrganization,
      organizationState: activeOrganization ? "ready" : "no-organization",
      setActiveOrganization: setActiveOrganizationId,
    };
  }, [activeOrganizationId, initialContext]);

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext(): OrganizationContextValue {
  const context = useContext(OrganizationContext);

  if (!context) {
    throw new Error(
      "useOrganizationContext must be used inside OrganizationProvider.",
    );
  }

  return context;
}

export function useActiveOrganization(): Organization | null {
  return useOrganizationContext().activeOrganization;
}
