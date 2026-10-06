import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/lib/supabase/database";

export type Organization = Tables<"organizations">;
export type OrganizationMembership = Tables<"organization_users">;

export type ApplicationContext = {
  user: User;
  memberships: OrganizationMembership[];
  organizations: Organization[];
  activeOrganization: Organization | null;
};

export type ApplicationContextState =
  | { status: "ready"; context: ApplicationContext }
  | { status: "no-organization"; context: ApplicationContext }
  | { status: "unauthenticated" };

export type AppErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "ORGANIZATION_NOT_FOUND"
  | "DATABASE_ERROR"
  | "RPC_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = cause;
  }
}
