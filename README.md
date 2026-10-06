# pomelo-erp

A modern ERP platform for inventory and business management with double-entry accounting, sales, purchases, payments, expenses, AR/AP, and financial reporting.

## Database status: FINALIZED / FROZEN

The Pomelo ERP database schema is **finalized and frozen**. It is the approved database baseline for application development.

- **Do not change the database schema.**
- **Do not create new database migrations.**
- **Do not add, remove, or alter tables, columns, enums, constraints, indexes, RLS policies, or public RPC contracts.**
- Application development must use the existing schema and supported RPCs as-is.
- Database validation is performed against disposable/local Supabase environments; the frozen database is not a target for application-time schema changes.

The canonical definition is `supabase/migrations/20261004120000_initial_erp_schema.sql`.

The finalized baseline is covered by the repository's database regression and real-life organization acceptance suites.
