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