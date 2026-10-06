# pomelo-erp

A modern ERP platform for inventory and business management with double-entry accounting, sales, purchases, payments, expenses, AR/AP, and financial reporting.

## Application foundation

The application is built with Next.js App Router and Supabase SSR.

- Next.js 16
- TypeScript
- Supabase JS
- Supabase SSR
- Cookie-based authentication/session refresh
- Application CI for typecheck, lint, and production build

### Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never expose a Supabase secret/service-role key to browser code.

## Database status: FINALIZED / FROZEN

The Pomelo ERP database schema is finalized and frozen. Application development must consume the existing schema and public RPC contracts as-is.

- Do not change the database schema.
- Do not create new database migrations.
- Do not add, remove, or alter tables, columns, enums, constraints, indexes, RLS policies, or public RPC contracts.
