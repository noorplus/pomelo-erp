/*
================================================================================
Pomelo ERP - Initial Database Schema
================================================================================

PROJECT
-------
Pomelo ERP is a clean ERP rebuild for inventory and business management.

DATABASE SCOPE
--------------
This schema is designed to support:
  - double-entry accounting
  - inventory and weighted-average-cost valuation
  - purchases and purchase returns
  - sales and sales returns
  - payments, allocations and refunds
  - expenses and expense categories
  - accounts receivable / accounts payable
  - accounting periods and financial controls
  - multi-organization tenant isolation
  - security, immutability and historical traceability

CORE DESIGN RULES
-----------------
- PostgreSQL/Supabase is the financial and inventory source of truth.
- Business-critical posting will be performed transactionally at the database
  boundary rather than through unsafe multi-step client-side writes.
- Every organization owns its business data through organization_id.
- Composite organization-aware foreign keys prevent cross-tenant references.
- Products represent inventory goods only. Rent, salary, electricity, transport,
  internet and similar non-stock costs are handled through Expenses.
- Posted accounting documents and inventory ledger records are immutable.
- Corrections use reversals and returns rather than destructive edits.
- A posted journal must contain at least two balanced debit/credit lines.
- Inventory quantity/value and accounting inventory must reconcile.
- Historical sales retain the COGS actually used when the sale was posted.

DISCOUNT POLICY
---------------
Invoice-level discounts are allocated deterministically by total quantity:

  per-unit discount = invoice discount / total invoice quantity

Purchase:
  net unit cost = original unit cost - allocated discount per unit

Sales:
  net unit price = original unit price - allocated discount per unit

High precision is stored for calculations. UI display rounding must not replace
the stored accounting value. Purchase discounts reduce inventory cost; sales
discounts reduce net revenue. Product master prices are never changed by an
invoice discount.

RETURN POLICY
-------------
- Purchase and sales returns reuse the invoice/item tables.
- original_invoice_id and original_item_id preserve transaction lineage.
- Posted return quantity cannot exceed the quantity originally posted.
- Purchase returns reverse historical net purchase cost.
- Sales returns reverse historical net sales price and historical COGS.
- Payment allocation never blocks a valid return.
- A refund is a separate payment/accounting event.

ACCOUNTING MODEL
----------------
  accounts
      |
      v
  journal_entries
      |
      v
  account_transactions

Journals start as draft and can be posted only after period/date/balance
validation. Posted journals and journal lines cannot be edited or deleted;
corrections use reversal journals.

INVENTORY MODEL
---------------
  products
      |
      +--> inventory_balances       (current materialized stock state)
      |
      +--> inventory_transactions   (immutable movement ledger)

Purchase receipts increase inventory at effective net cost. Sales decrease
inventory using historical WAC/COGS. Returns reverse the relevant historical
movement.

SECURITY MODEL
--------------
- RLS is enabled on all 21 public tables.
- Internal security-definer authorization helpers live in private schema.
- Tenant membership and role checks are enforced at the database boundary.
- The initial organization creator becomes the owner.
- Frontend authorization is not treated as the only security boundary.

MIGRATION SAFETY
----------------
IMPORTANT: THIS FILE IS A REPOSITORY MIGRATION ARTIFACT ONLY.

It MUST NOT be applied to a target/live database without explicit user approval.

Required workflow:
  Migration SQL
      -> GitHub
      -> isolated/local validation
      -> schema/security audit
      -> accounting integrity tests
      -> inventory integrity tests
      -> functional discount/return tests
      -> final review
      -> explicit user approval
      -> target database application

Committing this file changes GitHub only. It does not apply any database change.

================================================================================
*/

-- Required PostgreSQL extension for UUID generation.
create extension if not exists pgcrypto;
-- Required for the non-overlapping accounting-period exclusion constraint.
create extension if not exists btree_gist;
-- Private security-definer helpers; intentionally outside the public API surface.
create schema if not exists private;

-- Identity/profile layer linked to Supabase Auth.
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, phone text, avatar_url text, created_at timestamptz not null default now());
-- Tenant/business organization master.
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, legal_name text, phone text, email text, address text, city text, country text, base_currency char(3) not null default 'BDT', timezone text not null default 'Asia/Dhaka', logo_url text, tax_number text, is_active boolean not null default true, created_at timestamptz not null default now(), check(btrim(name)<>''), check(base_currency ~ '^[A-Z]{3}$'));
-- Organization membership and role assignments.
create table public.organization_users (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null check(role in('owner','admin','manager','staff')), is_active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,user_id), unique(organization_id,id));
create unique index organization_users_one_owner_uq on public.organization_users(organization_id) where role='owner' and is_active;
create index organization_users_user_idx on public.organization_users(user_id,organization_id);

-- Inventory master data: units used by products.
create table public.units_of_measure (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, code text not null, name text not null, symbol text, is_active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,code), check(btrim(code)<>''), check(btrim(name)<>''));
-- Accounting control: periods cannot overlap and closed periods are locked.
create table public.accounting_periods (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, start_date date not null, end_date date not null, status text not null default 'open' check(status in('open','closed')), closed_at timestamptz, created_at timestamptz not null default now(), unique(organization_id,id), check(start_date<=end_date), check((status='closed' and closed_at is not null) or(status='open' and closed_at is null)));
alter table public.accounting_periods add constraint accounting_periods_no_overlap_excl exclude using gist(organization_id with =,daterange(start_date,end_date+1,'[)') with &&);

-- Chart of Accounts: authoritative double-entry account master.
create table public.accounts (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, account_code text not null, account_name text not null, account_type text not null check(account_type in('asset','liability','equity','revenue','expense')), parent_account_id uuid, normal_balance text not null check(normal_balance in('debit','credit')), is_control_account boolean not null default false, is_system_account boolean not null default false, is_postable boolean not null default true, is_active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,account_code), foreign key(organization_id,parent_account_id) references public.accounts(organization_id,id), check(parent_account_id is null or parent_account_id<>id), check(btrim(account_code)<>''), check(btrim(account_name)<>''));
-- Inventory product master with accounting mappings.
create table public.products (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, product_code text not null, name text not null, description text, unit_id uuid not null, inventory_account_id uuid not null, sales_account_id uuid not null, cogs_account_id uuid not null, is_active boolean not null default true, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,product_code), foreign key(organization_id,unit_id) references public.units_of_measure(organization_id,id), foreign key(organization_id,inventory_account_id) references public.accounts(organization_id,id), foreign key(organization_id,sales_account_id) references public.accounts(organization_id,id), foreign key(organization_id,cogs_account_id) references public.accounts(organization_id,id), check(btrim(product_code)<>''), check(btrim(name)<>''));
-- Unified customer/supplier business contacts.
create table public.contacts (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, contact_number text not null, name text not null, phone text, email text, address text, is_active boolean not null default true, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,contact_number), check(btrim(name)<>''));
-- Controlled document numbering per organization/document type.
create table public.number_sequences (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, document_type text not null, prefix text not null default '', next_number bigint not null default 1, padding integer not null default 6, is_active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,document_type), check(next_number>0), check(padding between 1 and 12), check(btrim(document_type)<>''));
-- Journal header: draft-to-posted accounting transaction container.
create table public.journal_entries (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, entry_number text not null, accounting_period_id uuid not null, entry_date date not null, entry_type text not null check(entry_type in('manual','opening','purchase','purchase_return','sale','sale_return','payment','refund','expense','reversal')), status text not null default 'draft' check(status in('draft','posted')), reference_type text, reference_id uuid, description text, posted_at timestamptz, reversal_of_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,entry_number), foreign key(organization_id,accounting_period_id) references public.accounting_periods(organization_id,id), foreign key(organization_id,reversal_of_id) references public.journal_entries(organization_id,id), check((reference_type is null and reference_id is null) or(reference_type is not null and reference_id is not null)), check(reversal_of_id is null or(entry_type='reversal' and reversal_of_id<>id)));
-- Journal lines: individual debit/credit postings.
create table public.account_transactions (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, journal_entry_id uuid not null, account_id uuid not null, line_number integer not null, description text, debit numeric(20,8) not null default 0, credit numeric(20,8) not null default 0, contact_id uuid, created_at timestamptz not null default now(), unique(organization_id,journal_entry_id,line_number), foreign key(organization_id,journal_entry_id) references public.journal_entries(organization_id,id), foreign key(organization_id,account_id) references public.accounts(organization_id,id), foreign key(organization_id,contact_id) references public.contacts(organization_id,id), check(line_number>0), check(debit>=0 and credit>=0 and((debit>0 and credit=0)or(credit>0 and debit=0))));
-- Purchase documents and purchase returns share this table.
create table public.purchase_invoices (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, invoice_number text not null, document_type text not null default 'purchase' check(document_type in('purchase','return')), original_invoice_id uuid, supplier_id uuid not null, invoice_date date not null, status text not null default 'draft' check(status in('draft','posted','cancelled')), subtotal numeric(20,8) not null default 0, discount_amount numeric(20,8) not null default 0, total_amount numeric(20,8) not null default 0, posted_journal_entry_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,invoice_number), foreign key(organization_id,supplier_id) references public.contacts(organization_id,id), foreign key(organization_id,original_invoice_id) references public.purchase_invoices(organization_id,id), foreign key(organization_id,posted_journal_entry_id) references public.journal_entries(organization_id,id), check(subtotal>=0 and discount_amount>=0 and total_amount>=0 and discount_amount<=subtotal and total_amount=subtotal-discount_amount), check((document_type='purchase' and original_invoice_id is null)or(document_type='return' and original_invoice_id is not null)));
-- Purchase lines preserve original price, allocated discount and effective cost.
create table public.purchase_items (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, purchase_invoice_id uuid not null, line_number integer not null, product_id uuid not null, original_item_id uuid, quantity numeric(20,8) not null, unit_cost numeric(20,16) not null, discount_per_unit numeric(20,16) not null default 0, net_unit_cost numeric(20,16) not null, line_total numeric(20,8) not null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,purchase_invoice_id,line_number), foreign key(organization_id,purchase_invoice_id) references public.purchase_invoices(organization_id,id), foreign key(organization_id,product_id) references public.products(organization_id,id), foreign key(organization_id,original_item_id) references public.purchase_items(organization_id,id), check(quantity>0), check(unit_cost>=0 and discount_per_unit>=0 and net_unit_cost>=0 and discount_per_unit<=unit_cost), check(net_unit_cost=unit_cost-discount_per_unit), check(line_total=round(net_unit_cost*quantity,8)));
-- Sales documents and sales returns share this table.
create table public.sales_invoices (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, invoice_number text not null, document_type text not null default 'sale' check(document_type in('sale','return')), original_invoice_id uuid, customer_id uuid not null, invoice_date date not null, status text not null default 'draft' check(status in('draft','posted','cancelled')), subtotal numeric(20,8) not null default 0, discount_amount numeric(20,8) not null default 0, total_amount numeric(20,8) not null default 0, posted_journal_entry_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,invoice_number), foreign key(organization_id,customer_id) references public.contacts(organization_id,id), foreign key(organization_id,original_invoice_id) references public.sales_invoices(organization_id,id), foreign key(organization_id,posted_journal_entry_id) references public.journal_entries(organization_id,id), check(subtotal>=0 and discount_amount>=0 and total_amount>=0 and discount_amount<=subtotal and total_amount=subtotal-discount_amount), check((document_type='sale' and original_invoice_id is null)or(document_type='return' and original_invoice_id is not null)));
-- Sales lines preserve net selling price and historical COGS.
create table public.sales_items (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, sales_invoice_id uuid not null, line_number integer not null, product_id uuid not null, original_item_id uuid, quantity numeric(20,8) not null, unit_price numeric(20,16) not null, discount_per_unit numeric(20,16) not null default 0, net_unit_price numeric(20,16) not null, line_total numeric(20,8) not null, cogs_unit_cost numeric(20,16), cogs_total numeric(20,8), created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,sales_invoice_id,line_number), foreign key(organization_id,sales_invoice_id) references public.sales_invoices(organization_id,id), foreign key(organization_id,product_id) references public.products(organization_id,id), foreign key(organization_id,original_item_id) references public.sales_items(organization_id,id), check(quantity>0), check(unit_price>=0 and discount_per_unit>=0 and net_unit_price>=0 and discount_per_unit<=unit_price), check(net_unit_price=unit_price-discount_per_unit), check(line_total=round(net_unit_price*quantity,8)), check(cogs_unit_cost is null or(cogs_unit_cost>=0 and cogs_total=round(cogs_unit_cost*quantity,8))));
-- Current materialized stock state per organization/product.
create table public.inventory_balances (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, product_id uuid not null, quantity numeric(20,8) not null default 0, average_cost numeric(20,16) not null default 0, inventory_value numeric(20,8) not null default 0, updated_at timestamptz not null default now(), unique(organization_id,product_id), foreign key(organization_id,product_id) references public.products(organization_id,id), check(quantity>=0 and average_cost>=0 and inventory_value>=0), check(inventory_value=round(quantity*average_cost,8)));
-- Immutable inventory movement ledger.
create table public.inventory_transactions (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, transaction_number text not null, product_id uuid not null, transaction_date date not null, transaction_type text not null check(transaction_type in('opening','purchase','purchase_return','sale','sale_return','adjustment')), direction text not null check(direction in('in','out')), quantity numeric(20,8) not null, unit_cost numeric(20,16) not null, total_value numeric(20,8) not null, reference_type text not null, reference_id uuid not null, unit_cost_before numeric(20,16), average_cost_after numeric(20,16) not null, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,transaction_number), foreign key(organization_id,product_id) references public.products(organization_id,id), check(quantity>0), check(unit_cost>=0 and total_value=round(unit_cost*quantity,8)), check(average_cost_after>=0), check(unit_cost_before is null or unit_cost_before>=0));
-- Non-stock operating-cost categories mapped to expense accounts.
create table public.expense_categories (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, category_code text not null, name text not null, expense_account_id uuid not null, is_active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,category_code), foreign key(organization_id,expense_account_id) references public.accounts(organization_id,id), check(btrim(category_code)<>''), check(btrim(name)<>''));
-- Operating expenses; these are not inventory products.
create table public.expenses (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, expense_number text not null, expense_category_id uuid not null, contact_id uuid, expense_date date not null, amount numeric(20,8) not null, description text, status text not null default 'draft' check(status in('draft','posted','cancelled')), posted_journal_entry_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,expense_number), foreign key(organization_id,expense_category_id) references public.expense_categories(organization_id,id), foreign key(organization_id,contact_id) references public.contacts(organization_id,id), foreign key(organization_id,posted_journal_entry_id) references public.journal_entries(organization_id,id), check(amount>0));
-- Receipt/payment/refund events and their accounting references.
create table public.payments (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, payment_number text not null, payment_type text not null check(payment_type in('receipt','payment','refund_in','refund_out')), contact_id uuid, payment_date date not null, amount numeric(20,8) not null, account_id uuid not null, status text not null default 'draft' check(status in('draft','posted','cancelled')), posted_journal_entry_id uuid, description text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,payment_number), foreign key(organization_id,contact_id) references public.contacts(organization_id,id), foreign key(organization_id,account_id) references public.accounts(organization_id,id), foreign key(organization_id,posted_journal_entry_id) references public.journal_entries(organization_id,id), check(amount>0));
-- Allocation bridge between posted payments and posted documents.
create table public.payment_allocations (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, payment_id uuid not null, document_type text not null check(document_type in('purchase','purchase_return','sale','sale_return','expense')), document_id uuid not null, allocated_amount numeric(20,8) not null, created_at timestamptz not null default now(), foreign key(organization_id,payment_id) references public.payments(organization_id,id) on delete cascade, check(allocated_amount>0));

-- Reporting indexes.
create index journal_entries_period_idx on public.journal_entries(organization_id,accounting_period_id,entry_date);
create index account_transactions_account_idx on public.account_transactions(organization_id,account_id);
create index inventory_transactions_product_idx on public.inventory_transactions(organization_id,product_id,transaction_date,created_at);
create index payment_allocations_document_idx on public.payment_allocations(organization_id,document_type,document_id);

-- Centralized tenant membership and role authorization helpers.
create or replace function private.is_org_member(p_org_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.organization_users where organization_id=p_org_id and user_id=(select auth.uid()) and is_active); $$;
create or replace function private.has_org_role(p_org_id uuid,p_roles text[]) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.organization_users where organization_id=p_org_id and user_id=(select auth.uid()) and is_active and role=any(p_roles)); $$;
revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_org_member(uuid),private.has_org_role(uuid,text[]) from public;
grant execute on function private.is_org_member(uuid),private.has_org_role(uuid,text[]) to authenticated;

-- Establish the creator as the initial organization owner.
create or replace function private.bootstrap_organization_owner() returns trigger language plpgsql security definer set search_path='' as $$ begin if(select auth.uid()) is null then raise exception 'authenticated user required'; end if; insert into public.organization_users(organization_id,user_id,role) values(new.id,(select auth.uid()),'owner'); return new; end; $$;
revoke all on function private.bootstrap_organization_owner() from public;
create trigger organizations_bootstrap_owner_trg after insert on public.organizations for each row execute function private.bootstrap_organization_owner();

-- Prevent destructive mutation of posted journals.
create or replace function private.guard_journal_mutation() returns trigger language plpgsql set search_path='' as $$ begin if tg_op='DELETE' then if old.status='posted' then raise exception 'posted journals cannot be deleted'; end if; return old; end if; if old.status='posted' then raise exception 'posted journals are immutable; use a reversal'; end if; return new; end; $$;
create trigger journal_entries_immutable_trg before update or delete on public.journal_entries for each row execute function private.guard_journal_mutation();

create or replace function private.guard_journal_line_mutation() returns trigger language plpgsql set search_path='' as $$ declare s text; eid uuid; begin if tg_op='DELETE' then eid=old.journal_entry_id; else eid=new.journal_entry_id; end if; select status into s from public.journal_entries where id=eid; if s='posted' then raise exception 'posted journal lines are immutable'; end if; if tg_op='DELETE' then return old; else return new; end if; end; $$;
create trigger account_transactions_immutable_trg before insert or update or delete on public.account_transactions for each row execute function private.guard_journal_line_mutation();

-- Posting gate: open period, valid date and balanced journal.
create or replace function private.validate_journal_post() returns trigger language plpgsql set search_path='' as $$ declare d numeric(30,8); c numeric(30,8); n integer; ps text; pstart date; pend date; begin if new.status='posted' then if tg_op='UPDATE' and old.status='posted' then return new; end if; if tg_op='INSERT' then raise exception 'create journal as draft before posting'; end if; select status,start_date,end_date into ps,pstart,pend from public.accounting_periods where id=new.accounting_period_id and organization_id=new.organization_id; if ps is null or ps<>'open' then raise exception 'journal period is not open'; end if; if new.entry_date<pstart or new.entry_date>pend then raise exception 'journal date is outside period'; end if; select count(*),coalesce(sum(debit),0),coalesce(sum(credit),0) into n,d,c from public.account_transactions where organization_id=new.organization_id and journal_entry_id=new.id; if n<2 or round(d,8)<>round(c,8) then raise exception 'journal must have at least two balanced lines'; end if; if exists(select 1 from public.account_transactions l join public.accounts a on a.id=l.account_id and a.organization_id=l.organization_id where l.organization_id=new.organization_id and l.journal_entry_id=new.id and (not a.is_active or not a.is_postable)) then raise exception 'journal contains inactive or non-postable account'; end if; if new.entry_type='reversal' then if new.reversal_of_id is null then raise exception 'reversal journal requires reversal_of_id'; end if; if not exists(select 1 from public.journal_entries r where r.id=new.reversal_of_id and r.organization_id=new.organization_id and r.status='posted') then raise exception 'reversal target must be a posted journal'; end if; end if; new.posted_at=coalesce(new.posted_at,now()); end if; return new; end; $$;
create trigger journal_entries_post_trg before insert or update on public.journal_entries for each row execute function private.validate_journal_post();

-- Prevent destructive mutation of posted business documents.
create or replace function private.guard_posted_document() returns trigger language plpgsql set search_path='' as $$ begin if tg_op='DELETE' then if old.status='posted' then raise exception 'posted documents cannot be deleted'; end if; return old; end if; if old.status='posted' then raise exception 'posted documents cannot be modified'; end if; if old.status='cancelled' and new.status<>'cancelled' then raise exception 'cancelled documents cannot be reopened'; end if; return new; end; $$;
create trigger purchase_invoices_immutable_trg before update or delete on public.purchase_invoices for each row execute function private.guard_posted_document();
create trigger sales_invoices_immutable_trg before update or delete on public.sales_invoices for each row execute function private.guard_posted_document();
create trigger expenses_immutable_trg before update or delete on public.expenses for each row execute function private.guard_posted_document();
create trigger payments_immutable_trg before update or delete on public.payments for each row execute function private.guard_posted_document();

-- Keep the inventory movement ledger append-only.
create or replace function private.guard_inventory_ledger() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'inventory transactions are immutable'; end; $$;
create trigger inventory_transactions_immutable_trg before update or delete on public.inventory_transactions for each row execute function private.guard_inventory_ledger();

-- Prevent reopening a closed accounting period.
create or replace function private.guard_accounting_period() returns trigger language plpgsql set search_path='' as $$ begin if old.status='closed' and(new.status<>'closed' or new.closed_at is distinct from old.closed_at) then raise exception 'closed period cannot be reopened'; end if; if old.status='open' and new.status='closed' and new.closed_at is null then new.closed_at=now(); end if; return new; end; $$;
create trigger accounting_period_close_guard_trg before update on public.accounting_periods for each row execute function private.guard_accounting_period();

-- Invoice items can change only while their parent is draft.
create or replace function private.guard_draft_item() returns trigger language plpgsql set search_path='' as $$ declare s text; iid uuid; begin if tg_op='DELETE' then if tg_table_name='purchase_items' then iid=old.purchase_invoice_id; else iid=old.sales_invoice_id; end if; else if tg_table_name='purchase_items' then iid=new.purchase_invoice_id; else iid=new.sales_invoice_id; end if; end if; if tg_table_name='purchase_items' then select status into s from public.purchase_invoices where id=iid; else select status into s from public.sales_invoices where id=iid; end if; if s<>'draft' then raise exception 'items can only change while document is draft'; end if; if tg_op='DELETE' then return old; else return new; end if; end; $$;
create trigger purchase_items_draft_guard_trg before insert or update or delete on public.purchase_items for each row execute function private.guard_draft_item();
create trigger sales_items_draft_guard_trg before insert or update or delete on public.sales_items for each row execute function private.guard_draft_item();

-- Purchase posting: totals, discount allocation and return lineage.
create or replace function private.validate_purchase_post() returns trigger language plpgsql set search_path='' as $$ declare q numeric(30,8); gross numeric(30,8); dp numeric(30,16); x record; os text; returned numeric(30,8); begin if new.status<>'posted' then return new; end if; if tg_op='UPDATE' and old.status='posted' then return new; end if; select coalesce(sum(quantity),0),coalesce(sum(quantity*unit_cost),0) into q,gross from public.purchase_items where organization_id=new.organization_id and purchase_invoice_id=new.id; if q<=0 or round(gross,8)<>round(new.subtotal,8) then raise exception 'purchase lines do not match subtotal'; end if; dp=new.discount_amount/q; for x in select * from public.purchase_items where organization_id=new.organization_id and purchase_invoice_id=new.id loop if abs(x.discount_per_unit-dp)>0.00000000000001 or abs(x.net_unit_cost-(x.unit_cost-dp))>0.00000000000001 then raise exception 'purchase discount must be equal per unit'; end if; end loop; if round((select coalesce(sum(line_total),0) from public.purchase_items where organization_id=new.organization_id and purchase_invoice_id=new.id),8)<>round(new.total_amount,8) then raise exception 'purchase line totals do not match invoice total'; end if; if new.document_type='return' then if new.discount_amount<>0 then raise exception 'returns cannot introduce a new discount'; end if; select status into os from public.purchase_invoices where id=new.original_invoice_id and organization_id=new.organization_id; if os<>'posted' then raise exception 'return requires posted original purchase'; end if; for x in select * from public.purchase_items where organization_id=new.organization_id and purchase_invoice_id=new.id loop if x.original_item_id is null or x.discount_per_unit<>0 or x.unit_cost<>(select net_unit_cost from public.purchase_items where organization_id=new.organization_id and id=x.original_item_id) then raise exception 'purchase return must reverse historical net cost'; end if; select coalesce(sum(ri.quantity),0) into returned from public.purchase_items ri join public.purchase_invoices r on r.id=ri.purchase_invoice_id and r.organization_id=ri.organization_id where ri.organization_id=new.organization_id and ri.original_item_id=x.original_item_id and r.document_type='return' and r.status='posted'; if returned+x.quantity>(select quantity from public.purchase_items where organization_id=new.organization_id and id=x.original_item_id) then raise exception 'purchase return exceeds original quantity'; end if; end loop; end if; return new; end; $$;
create trigger purchase_post_validation_trg before insert or update on public.purchase_invoices for each row execute function private.validate_purchase_post();

-- Sales posting: totals, discount allocation, COGS and return lineage.
create or replace function private.validate_sale_post() returns trigger language plpgsql set search_path='' as $$ declare q numeric(30,8); gross numeric(30,8); dp numeric(30,16); x record; os text; returned numeric(30,8); begin if new.status<>'posted' then return new; end if; if tg_op='UPDATE' and old.status='posted' then return new; end if; select coalesce(sum(quantity),0),coalesce(sum(quantity*unit_price),0) into q,gross from public.sales_items where organization_id=new.organization_id and sales_invoice_id=new.id; if q<=0 or round(gross,8)<>round(new.subtotal,8) then raise exception 'sales lines do not match subtotal'; end if; dp=new.discount_amount/q; for x in select * from public.sales_items where organization_id=new.organization_id and sales_invoice_id=new.id loop if x.cogs_unit_cost is null or x.cogs_total is null then raise exception 'sale requires historical COGS at posting'; end if; if abs(x.discount_per_unit-dp)>0.00000000000001 or abs(x.net_unit_price-(x.unit_price-dp))>0.00000000000001 then raise exception 'sales discount must be equal per unit'; end if; end loop; if round((select coalesce(sum(line_total),0) from public.sales_items where organization_id=new.organization_id and sales_invoice_id=new.id),8)<>round(new.total_amount,8) then raise exception 'sales line totals do not match invoice total'; end if; if new.document_type='return' then if new.discount_amount<>0 then raise exception 'returns cannot introduce a new discount'; end if; select status into os from public.sales_invoices where id=new.original_invoice_id and organization_id=new.organization_id; if os<>'posted' then raise exception 'return requires posted original sale'; end if; for x in select * from public.sales_items where organization_id=new.organization_id and sales_invoice_id=new.id loop if x.original_item_id is null or x.discount_per_unit<>0 or x.unit_price<>(select net_unit_price from public.sales_items where organization_id=new.organization_id and id=x.original_item_id) or x.cogs_unit_cost<>(select cogs_unit_cost from public.sales_items where organization_id=new.organization_id and id=x.original_item_id) then raise exception 'sales return must reverse historical price and COGS'; end if; select coalesce(sum(ri.quantity),0) into returned from public.sales_items ri join public.sales_invoices r on r.id=ri.sales_invoice_id and r.organization_id=ri.organization_id where ri.organization_id=new.organization_id and ri.original_item_id=x.original_item_id and r.document_type='return' and r.status='posted'; if returned+x.quantity>(select quantity from public.sales_items where organization_id=new.organization_id and id=x.original_item_id) then raise exception 'sales return exceeds original quantity'; end if; end loop; end if; return new; end; $$;
create trigger sales_post_validation_trg before insert or update on public.sales_invoices for each row execute function private.validate_sale_post();

-- Payment allocation: posted target and allocation ceiling.
create or replace function private.validate_payment_allocation() returns trigger language plpgsql set search_path='' as $$ declare pa numeric(30,8); ps text; allocated numeric(30,8); ok boolean:=false; begin select amount,status into pa,ps from public.payments where id=new.payment_id and organization_id=new.organization_id; if ps is null then raise exception 'payment not found'; end if; if ps<>'posted' then raise exception 'payment must be posted before allocation'; end if; if new.document_type in('purchase','purchase_return') then select exists(select 1 from public.purchase_invoices where id=new.document_id and organization_id=new.organization_id and status='posted') into ok; elsif new.document_type in('sale','sale_return') then select exists(select 1 from public.sales_invoices where id=new.document_id and organization_id=new.organization_id and status='posted') into ok; else select exists(select 1 from public.expenses where id=new.document_id and organization_id=new.organization_id and status='posted') into ok; end if; if not ok then raise exception 'allocation target must be posted'; end if; select coalesce(sum(allocated_amount),0) into allocated from public.payment_allocations where organization_id=new.organization_id and payment_id=new.payment_id and id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid); if allocated+new.allocated_amount>pa then raise exception 'payment allocations exceed payment amount'; end if; return new; end; $$;
create trigger payment_allocations_validation_trg before insert or update on public.payment_allocations for each row execute function private.validate_payment_allocation();

-- RLS boundary for all 21 public tables.
do $ declare t text; begin foreach t in array array['profiles','organizations','organization_users','units_of_measure','products','contacts','number_sequences','accounts','journal_entries','account_transactions','accounting_periods','purchase_invoices','purchase_items','sales_invoices','sales_items','inventory_balances','inventory_transactions','expense_categories','expenses','payments','payment_allocations'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on table public.%I from anon,authenticated',t); execute format('grant select on table public.%I to authenticated',t); end loop; end $$;

create policy profiles_select on public.profiles for select to authenticated using((select auth.uid())=id);
create policy profiles_insert on public.profiles for insert to authenticated with check((select auth.uid())=id);
create policy profiles_update on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy organizations_select on public.organizations for select to authenticated using((select private.is_org_member(id)));
create policy organizations_insert on public.organizations for insert to authenticated with check((select auth.uid()) is not null);
create policy organizations_update on public.organizations for update to authenticated using((select private.has_org_role(id,array['owner','admin']))) with check((select private.has_org_role(id,array['owner','admin'])));
create policy organization_users_select on public.organization_users for select to authenticated using((select private.is_org_member(organization_id)));
create policy organization_users_insert on public.organization_users for insert to authenticated with check((select private.has_org_role(organization_id,array['owner','admin'])));
create policy organization_users_update on public.organization_users for update to authenticated using((select private.has_org_role(organization_id,array['owner','admin']))) with check((select private.has_org_role(organization_id,array['owner','admin'])));
create policy organization_users_delete on public.organization_users for delete to authenticated using((select private.has_org_role(organization_id,array['owner','admin'])));

do $$ declare t text; begin foreach t in array array['units_of_measure','products','contacts','number_sequences','accounts','accounting_periods','expense_categories','journal_entries','account_transactions','inventory_balances','inventory_transactions','purchase_invoices','purchase_items','sales_invoices','sales_items','expenses','payments','payment_allocations'] loop execute format('create policy %I_select on public.%I for select to authenticated using ((select private.is_org_member(organization_id)))',t,t); end loop; end $$;

create policy units_write on public.units_of_measure for all to authenticated using((select private.has_org_role(organization_id,array['owner','admin','manager']))) with check((select private.has_org_role(organization_id,array['owner','admin','manager'])));
create policy products_write on public.products for all to authenticated using((select private.has_org_role(organization_id,array['owner','admin','manager']))) with check((select private.has_org_role(organization_id,array['owner','admin','manager'])));
create policy contacts_write on public.contacts for all to authenticated using((select private.has_org_role(organization_id,array['owner','admin','manager','staff']))) with check((select private.has_org_role(organization_id,array['owner','admin','manager','staff'])));
create policy sequences_write on public.number_sequences for update to authenticated using((select private.has_org_role(organization_id,array['owner','admin']))) with check((select private.has_org_role(organization_id,array['owner','admin'])));
create policy accounts_write on public.accounts for all to authenticated using((select private.has_org_role(organization_id,array['owner','admin']))) with check((select private.has_org_role(organization_id,array['owner','admin'])));
create policy periods_write on public.accounting_periods for all to authenticated using((select private.has_org_role(organization_id,array['owner','admin']))) with check((select private.has_org_role(organization_id,array['owner','admin'])));
create policy expense_categories_write on public.expense_categories for all to authenticated using((select private.has_org_role(organization_id,array['owner','admin']))) with check((select private.has_org_role(organization_id,array['owner','admin'])));
do $$ declare t text; begin foreach t in array array['purchase_invoices','purchase_items','sales_invoices','sales_items','expenses','payments','payment_allocations'] loop execute format('create policy %I_write on public.%I for all to authenticated using((select private.has_org_role(organization_id,array['owner','admin','manager','staff']))) with check((select private.has_org_role(organization_id,array['owner','admin','manager','staff'])))',t,t); end loop; end $$;

grant select,insert,update on public.profiles to authenticated;
grant select,insert,update on public.organizations to authenticated;
grant select,insert,update,delete on public.organization_users to authenticated;
grant select,insert,update,delete on public.units_of_measure to authenticated;
grant select,insert,update on public.products,public.contacts to authenticated;
grant select,update on public.number_sequences to authenticated;
grant select,insert,update on public.accounts,public.accounting_periods to authenticated;
grant select on public.journal_entries,public.account_transactions,public.inventory_balances,public.inventory_transactions to authenticated;
grant select,insert,update,delete on public.purchase_invoices,public.purchase_items,public.sales_invoices,public.sales_items,public.expenses,public.payments,public.payment_allocations to authenticated;
