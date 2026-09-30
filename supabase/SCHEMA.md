# Pomelo ERP Database Schema

## Status
Audited migration draft only. Not applied to any target/live database.

## 21 public tables
profiles, organizations, organization_users, units_of_measure, products, contacts, number_sequences, accounts, journal_entries, account_transactions, accounting_periods, purchase_invoices, purchase_items, sales_invoices, sales_items, inventory_balances, inventory_transactions, expense_categories, expenses, payments, payment_allocations.

## Discount rule
For every invoice, regardless of the number of lines/products:

**discount per unit = total invoice discount / total invoice quantity**

Purchase: **net unit cost = original unit cost - discount per unit**

Sales: **net unit price = original unit price - discount per unit**

Per-unit values use high precision. UI may display two decimals, but display rounding is never the accounting source value. The invoice header remains authoritative for total discount and total amount.

## Returns
Returns reuse the purchase/sales invoice tables. The original invoice and original item are preserved. Posted return quantity cannot exceed the original quantity. Returns reverse historical purchase net cost / sales net price and historical COGS. Payment allocation never blocks a return; refund or credit-balance handling is a separate accounting/payment event.

## Accounting
Double-entry is accounts -> journal_entries -> account_transactions. Posted journals are immutable. Posting requires an open accounting period, a valid date, at least two lines, and equal debit/credit totals. Corrections use reversal journals.

## Inventory
Products are inventory products. Non-stock expenses use expense categories. Inventory transactions are immutable. Products map to inventory, revenue, and COGS accounts. Sales retain historical COGS.

## Security
All 21 public tables have RLS enabled. Tenant-owned references use composite (organization_id,id) foreign keys where appropriate. Internal security-definer helpers live in the non-exposed private schema with search_path=''.

## Migration discipline
Migration -> isolated/local validation -> schema/security audit -> accounting/inventory integrity tests -> final review -> explicit user approval -> target DB.

This change stops before target DB application.

## Transactional posting RPC layer

Business-critical posting is performed through database transactions rather than client-side multi-step writes.

Public posting functions:
- `post_purchase_invoice(invoice_id, payable_account_id)`
- `post_sales_invoice(invoice_id, receivable_account_id)`
- `post_expense(expense_id, credit_account_id)`
- `post_payment(payment_id, settlement_account_id, allocations)`
- `post_manual_journal(org_id, entry_date, description, lines, entry_type)`
- `reverse_journal(journal_id, reversal_date, description)`

Operational posting updates the document, inventory balance, immutable inventory ledger, journal header/lines, and payment allocations atomically. A failure rolls back the complete operation.

Purchase and sales returns are independent documents and remain valid after the original purchase/sale has already been paid. Refunds are separate payment events.

Payment allocations are validated against both payment amount and document amount, serialized with row locks, matched to the payment contact, and immutable after creation.

## Automated validation

The repository contains:
- `supabase/tests/initial_erp_schema.test.sql` — schema/security assertions.
- `supabase/tests/erp_posting.test.sql` — end-to-end purchase, sale, payment, return, refund, expense, and reconciliation scenario.
- `.github/workflows/database-tests.yml` — isolated local Supabase migration reset, pgTAP execution, and PostgreSQL error-level lint.

The local/CI suite must pass before any target database application is considered.
