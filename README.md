# Pomelo ERP

A modern ERP platform for inventory and business management with double-entry accounting, sales, purchases, payments, expenses, AR/AP, and financial reporting.

## Architecture

Pomelo ERP is being built as a clean ERP foundation rather than a copy of the legacy inventory application.

Core domains:

- Accounting: chart of accounts, journal entries, general ledger, trial balance, financial statements
- Inventory: products, stock balances, inventory transactions, valuation
- Purchasing: purchase documents, supplier balances, purchase returns
- Sales: sales documents, customer balances, sales returns
- Finance: payments, expenses, cash and bank
- Controls: accounting periods, posting integrity, audit trail

## Development principles

- PostgreSQL/Supabase is the source of truth.
- Business-critical mutations are transactional and validated at the database boundary.
- Posted accounting entries are immutable; corrections use reversals.
- Inventory valuation and accounting inventory must reconcile.
- Debit and credit totals must balance for every journal entry.
- Build and test each domain incrementally before integrating the next one.


<!-- CI validation trigger: isolated database test run 6 -->
