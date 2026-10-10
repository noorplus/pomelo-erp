# Pomelo ERP — UI and Data Presentation Standards

## Purpose

Create one predictable information hierarchy across every route so users can scan records, understand their status, find important values, and locate the next action without interpreting a different layout on every page.

## Non-negotiable constraints

- Supabase is frozen: do not alter schema, data, functions, RPCs, or migration history.
- Do not add migrations or invent fields, records, statuses, metrics, or business behavior.
- Build the presentation only from existing typed records and supported queries/actions.
- Prefer shared components over page-specific markup and keep TypeScript strict.

## Route inventory (42 page routes)

### Dashboard
- `/` (app dashboard)

### Contacts and products
- `/contacts`, `/contacts/new`, `/contacts/[id]`
- `/products`, `/products/new`, `/products/[id]`

### Sales
- `/sales`, `/sales/invoices`, `/sales/invoices/new`, `/sales/invoices/[id]`
- `/sales/returns`, `/sales/returns/new`, `/sales/returns/[id]`

### Purchase
- `/purchase`, `/purchase/invoices`, `/purchase/invoices/new`, `/purchase/invoices/[id]`
- `/purchase/returns`, `/purchase/returns/new`, `/purchase/returns/[id]`

### Inventory
- `/inventory`, `/inventory/stock`, `/inventory/transactions`, `/inventory/products/[id]`

### Accounting
- `/accounting`, `/accounting/accounts`, `/accounting/ledger`, `/accounting/opening-balance`, `/accounting/periods`, `/accounting/receivables-payables`
- `/accounting/reports/trial-balance`, `/accounting/reports/profit-loss`, `/accounting/reports/balance-sheet`
- `/accounting/setup/expense-categories`, `/accounting/transactions/expenses`, `/accounting/transactions/journal-entries`, `/accounting/transactions/journal-entries/[id]`, `/accounting/transactions/payments`, `/accounting/transactions/payments/[id]`

### Administration and access
- `/administration`, `/login`

## Presentation rules

1. **Page header:** one clear title, concise purpose, and primary action(s) grouped consistently.
2. **Sections:** related information belongs together under a descriptive heading; unrelated tables and forms should not visually run into each other.
3. **Summary values:** show only when calculated from real records; use consistent number alignment and clear labels.
4. **Tables:** put identifiers and names first, dates and relationships next, monetary/quantity values together, and lifecycle status/actions at the end. Numeric values should use tabular figures and right alignment where the column is explicitly configured for it.
5. **Search and filtering:** keep controls next to the dataset they affect; show the filtered/total record count where available.
6. **States:** loading, error, empty, and no-search-results states must be distinct and explain the next useful action where possible.
7. **Forms:** group fields by business purpose, use explicit labels/help text, and separate save/cancel actions from data entry.
8. **Detail pages:** show the document/entity identity first, lifecycle status and key totals clearly, then related lines/references and secondary metadata.
9. **Responsive behavior:** action groups wrap cleanly, data tables scroll within their own container, and important values never cause page-wide horizontal overflow.
10. **Consistency:** use shared `PageHeader`, `PageSection`, `DataTable`, status badges, and formatting utilities instead of duplicating styles or logic.

## Changes in this pass

- Standardized the shared section surface, spacing, headings, summary tiles, table typography, and mobile stacking so routes using the shared primitives have a more consistent information hierarchy.
- Converted the product catalogue to the shared section/search pattern and made the visible result count explicit.
- Removed the hard-coded “Configured” product unit cell because it did not display a real unit name or value. The frozen schema/query remains the source of truth; no placeholder is presented as data.
- Removed the standalone Master Data page and navigation entry; moved unit creation/editing into Products and the read-only document-number sequence view into Administration. The old `/master-data` URL permanently redirects to `/products`.

## Follow-up review checklist

Review each route against the rules above and verify the rendered output at desktop and narrow mobile widths. Prioritize document detail/form pages, accounting reports, transaction lists, and configuration pages. Confirm all labels and calculations against existing query shapes and the generated Supabase types before changing presentation. Run typecheck, lint, production build, and database CI; database CI must remain isolated from production.
