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
-- Keep btree_gist out of the exposed public schema.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
-- Make extension-provided GiST operator classes resolvable when creating
-- the accounting-period exclusion constraint below.
set local search_path = extensions, public;
-- Private security-definer helpers; intentionally outside the public API surface.
create schema if not exists private;

-- Identity/profile layer linked to Supabase Auth.
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, phone text, avatar_url text, created_at timestamptz not null default now());
-- Tenant/business organization master.
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, phone text, email text, address text, city text, country text, base_currency char(3) not null default 'BDT', timezone text not null default 'Asia/Dhaka', logo_url text, tax_number text, is_active boolean not null default true, created_at timestamptz not null default now(), check(btrim(name)<>''), check(base_currency ~ '^[A-Z]{3}
-- Organization membership and role assignments.
create table public.organization_users (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null check(role in('owner','admin','manager','staff')), is_active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,user_id), unique(organization_id,id));
create unique index organization_users_one_owner_uq on public.organization_users(organization_id) where role='owner' and is_active;
create index organization_users_user_idx on public.organization_users(user_id,organization_id);

-- Inventory master data: units used by products.
create table public.units_of_measure (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, is_active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,id), check(btrim(name)<>''));
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
create table public.journal_entries (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, entry_number text not null, accounting_period_id uuid not null, entry_date date not null, entry_type text not null check(entry_type in('manual','opening','purchase','purchase_return','sale','sale_return','payment','refund','expense','reversal')), status text not null default 'draft' check(status in('draft','posted')), reference_type text, reference_id uuid, description text, posted_at timestamptz, reversal_of_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,entry_number), constraint journal_entries_posted_state_ck check((status='posted' and posted_at is not null) or (status='draft' and posted_at is null)), foreign key(organization_id,accounting_period_id) references public.accounting_periods(organization_id,id), foreign key(organization_id,reversal_of_id) references public.journal_entries(organization_id,id), check((reference_type is null and reference_id is null) or(reference_type is not null and reference_id is not null)), check(reversal_of_id is null or(entry_type='reversal' and reversal_of_id<>id)));
-- Journal lines: individual debit/credit postings.
create table public.account_transactions (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, journal_entry_id uuid not null, account_id uuid not null, line_number integer not null, description text, debit numeric(20,8) not null default 0, credit numeric(20,8) not null default 0, contact_id uuid, created_at timestamptz not null default now(), unique(organization_id,journal_entry_id,line_number), foreign key(organization_id,journal_entry_id) references public.journal_entries(organization_id,id), foreign key(organization_id,account_id) references public.accounts(organization_id,id), foreign key(organization_id,contact_id) references public.contacts(organization_id,id), check(line_number>0), check(debit>=0 and credit>=0 and((debit>0 and credit=0)or(credit>0 and debit=0))));
-- Purchase documents and purchase returns share this table.
create table public.purchase_invoices (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, invoice_number text not null, document_type text not null default 'purchase' check(document_type in('purchase','return')), original_invoice_id uuid, supplier_id uuid not null, invoice_date date not null, status text not null default 'draft' check(status in('draft','posted','cancelled')), subtotal numeric(20,8) not null default 0, discount_amount numeric(20,8) not null default 0, total_amount numeric(20,8) not null default 0, payable_account_id uuid, posted_journal_entry_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,invoice_number), foreign key(organization_id,supplier_id) references public.contacts(organization_id,id), foreign key(organization_id,original_invoice_id) references public.purchase_invoices(organization_id,id), foreign key(organization_id,payable_account_id) references public.accounts(organization_id,id), foreign key(organization_id,posted_journal_entry_id) references public.journal_entries(organization_id,id), check(subtotal>=0 and discount_amount>=0 and total_amount>=0 and discount_amount<=subtotal and total_amount=subtotal-discount_amount), check((document_type='purchase' and original_invoice_id is null)or(document_type='return' and original_invoice_id is not null)), constraint purchase_invoices_posted_state_ck check((status='posted') = (posted_journal_entry_id is not null)));
-- Purchase lines preserve original price, allocated discount and effective cost.
create table public.purchase_items (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, purchase_invoice_id uuid not null, line_number integer not null, product_id uuid not null, original_item_id uuid, quantity numeric(20,8) not null, unit_cost numeric(20,16) not null, discount_per_unit numeric(20,16) not null default 0, net_unit_cost numeric(20,16) not null, line_total numeric(20,8) not null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,purchase_invoice_id,line_number), foreign key(organization_id,purchase_invoice_id) references public.purchase_invoices(organization_id,id), foreign key(organization_id,product_id) references public.products(organization_id,id), foreign key(organization_id,original_item_id) references public.purchase_items(organization_id,id), check(quantity>0), check(unit_cost>=0 and discount_per_unit>=0 and net_unit_cost>=0 and discount_per_unit<=unit_cost), check(net_unit_cost=unit_cost-discount_per_unit), check(line_total=round(net_unit_cost*quantity,8)));
-- Sales documents and sales returns share this table.
create table public.sales_invoices (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, invoice_number text not null, document_type text not null default 'sale' check(document_type in('sale','return')), original_invoice_id uuid, customer_id uuid not null, invoice_date date not null, status text not null default 'draft' check(status in('draft','posted','cancelled')), subtotal numeric(20,8) not null default 0, discount_amount numeric(20,8) not null default 0, total_amount numeric(20,8) not null default 0, receivable_account_id uuid, posted_journal_entry_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,invoice_number), foreign key(organization_id,customer_id) references public.contacts(organization_id,id), foreign key(organization_id,original_invoice_id) references public.sales_invoices(organization_id,id), foreign key(organization_id,receivable_account_id) references public.accounts(organization_id,id), foreign key(organization_id,posted_journal_entry_id) references public.journal_entries(organization_id,id), check(subtotal>=0 and discount_amount>=0 and total_amount>=0 and discount_amount<=subtotal and total_amount=subtotal-discount_amount), check((document_type='sale' and original_invoice_id is null)or(document_type='return' and original_invoice_id is not null)), constraint sales_invoices_posted_state_ck check((status='posted') = (posted_journal_entry_id is not null)));
-- Sales lines preserve net selling price and historical COGS.
create table public.sales_items (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, sales_invoice_id uuid not null, line_number integer not null, product_id uuid not null, original_item_id uuid, quantity numeric(20,8) not null, unit_price numeric(20,16) not null, discount_per_unit numeric(20,16) not null default 0, net_unit_price numeric(20,16) not null, line_total numeric(20,8) not null, cogs_unit_cost numeric(20,16), cogs_total numeric(20,8), created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,sales_invoice_id,line_number), foreign key(organization_id,sales_invoice_id) references public.sales_invoices(organization_id,id), foreign key(organization_id,product_id) references public.products(organization_id,id), foreign key(organization_id,original_item_id) references public.sales_items(organization_id,id), check(quantity>0), check(unit_price>=0 and discount_per_unit>=0 and net_unit_price>=0 and discount_per_unit<=unit_price), check(net_unit_price=unit_price-discount_per_unit), check(line_total=round(net_unit_price*quantity,8)), check(cogs_unit_cost is null or(cogs_unit_cost>=0 and cogs_total=round(cogs_unit_cost*quantity,8))));
-- Current materialized stock state per organization/product.
create table public.inventory_balances (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, product_id uuid not null, quantity numeric(20,8) not null default 0, average_cost numeric(20,16) not null default 0, inventory_value numeric(20,8) not null default 0, updated_at timestamptz not null default now(), unique(organization_id,product_id), foreign key(organization_id,product_id) references public.products(organization_id,id), check(quantity>=0 and average_cost>=0 and inventory_value>=0), check(inventory_value=round(quantity*average_cost,8)));
-- Immutable inventory movement ledger.
create table public.inventory_transactions (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, transaction_number text not null, product_id uuid not null, transaction_date date not null, transaction_type text not null check(transaction_type in('opening','purchase','purchase_return','sale','sale_return','adjustment')), direction text not null check(direction in('in','out')), quantity numeric(20,8) not null, unit_cost numeric(20,16) not null, total_value numeric(20,8) not null, reference_type text not null, reference_id uuid not null, unit_cost_before numeric(20,16), average_cost_after numeric(20,16) not null, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,transaction_number), foreign key(organization_id,product_id) references public.products(organization_id,id), check(quantity>0), check(unit_cost>=0 and total_value=round(unit_cost*quantity,8)), check(average_cost_after>=0), check(unit_cost_before is null or unit_cost_before>=0));
-- Non-stock operating-cost categories mapped to expense accounts.
create table public.expense_categories (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, category_code text not null, name text not null, expense_account_id uuid not null, is_active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,category_code), foreign key(organization_id,expense_account_id) references public.accounts(organization_id,id), check(btrim(category_code)<>''), check(btrim(name)<>''));
-- Operating expenses; these are not inventory products.
create table public.expenses (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, expense_number text not null, expense_category_id uuid not null, contact_id uuid, payable_account_id uuid, expense_date date not null, amount numeric(20,8) not null, description text, status text not null default 'draft' check(status in('draft','posted','cancelled')), posted_journal_entry_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,expense_number), foreign key(organization_id,expense_category_id) references public.expense_categories(organization_id,id), foreign key(organization_id,contact_id) references public.contacts(organization_id,id), foreign key(organization_id,posted_journal_entry_id) references public.journal_entries(organization_id,id), check(amount>0), constraint expenses_posted_state_ck check((status='posted') = (posted_journal_entry_id is not null)));
-- Receipt/payment/refund events and their accounting references.
create table public.payments (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, payment_number text not null, payment_type text not null check(payment_type in('receipt','payment','refund_in','refund_out')), contact_id uuid, payment_date date not null, amount numeric(20,8) not null, account_id uuid not null, settlement_account_id uuid, status text not null default 'draft' check(status in('draft','posted','cancelled')), posted_journal_entry_id uuid, description text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,payment_number), foreign key(organization_id,contact_id) references public.contacts(organization_id,id), foreign key(organization_id,account_id) references public.accounts(organization_id,id), foreign key(organization_id,settlement_account_id) references public.accounts(organization_id,id), foreign key(organization_id,posted_journal_entry_id) references public.journal_entries(organization_id,id), check(amount>0), constraint payments_posted_state_ck check((status='posted') = (posted_journal_entry_id is not null)));
-- Allocation bridge between posted payments and posted documents.
create table public.payment_allocations (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, payment_id uuid not null, document_type text not null check(document_type in('purchase','purchase_return','sale','sale_return','expense')), document_id uuid not null, allocated_amount numeric(20,8) not null, created_at timestamptz not null default now(), foreign key(organization_id,payment_id) references public.payments(organization_id,id) on delete cascade, check(allocated_amount>0));

-- Reporting indexes.
create index journal_entries_period_idx on public.journal_entries(organization_id,accounting_period_id,entry_date);
create index account_transactions_account_idx on public.account_transactions(organization_id,account_id);
create index inventory_transactions_product_idx on public.inventory_transactions(organization_id,product_id,transaction_date,created_at);
create index payment_allocations_document_idx on public.payment_allocations(organization_id,document_type,document_id);
create index purchase_invoices_supplier_idx on public.purchase_invoices(organization_id,supplier_id,invoice_date);
create index purchase_items_product_idx on public.purchase_items(organization_id,product_id,purchase_invoice_id);
create index sales_invoices_customer_idx on public.sales_invoices(organization_id,customer_id,invoice_date);
create index sales_items_product_idx on public.sales_items(organization_id,product_id,sales_invoice_id);
create index expense_categories_account_idx on public.expense_categories(organization_id,expense_account_id);
create index expenses_category_idx on public.expenses(organization_id,expense_category_id,expense_date);
create index expenses_contact_idx on public.expenses(organization_id,contact_id,expense_date);
create index payments_contact_idx on public.payments(organization_id,contact_id,payment_date);
create index payments_account_idx on public.payments(organization_id,account_id,payment_date);

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

-- Never allow an organization to become ownerless through direct membership mutation.
create or replace function private.guard_last_owner_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $owner_guard$
begin
  if tg_op='DELETE'
     and old.role='owner'
     and old.is_active
     and not exists (
       select 1 from public.organization_users
       where organization_id=old.organization_id
         and role='owner' and is_active and id<>old.id
     ) then
    raise exception 'organization must retain an active owner';
  end if;

  if tg_op='UPDATE'
     and old.role='owner'
     and old.is_active
     and (new.role<>'owner' or not new.is_active)
     and not exists (
       select 1 from public.organization_users
       where organization_id=old.organization_id
         and role='owner' and is_active and id<>old.id
     ) then
    raise exception 'organization must retain an active owner';
  end if;

  return coalesce(new,old);
end;
$owner_guard$;
revoke all on function private.guard_last_owner_mutation() from public,authenticated;
create trigger organization_users_last_owner_guard_trg
before update or delete on public.organization_users
for each row execute function private.guard_last_owner_mutation();

-- Tenant-bound rows can never be moved between organizations.
create or replace function private.guard_tenant_id_change() returns trigger language plpgsql set search_path='' as $$ begin if tg_op='UPDATE' and old.organization_id is distinct from new.organization_id then raise exception 'organization_id cannot be changed'; end if; return new; end; $$;
revoke all on function private.guard_tenant_id_change() from public;
grant execute on function private.guard_tenant_id_change() to authenticated;
do $$ declare t text; begin foreach t in array array['organization_users','units_of_measure','accounting_periods','accounts','products','contacts','number_sequences','journal_entries','account_transactions','purchase_invoices','purchase_items','sales_invoices','sales_items','inventory_balances','inventory_transactions','expense_categories','expenses','payments','payment_allocations'] loop execute format('create trigger %I_tenant_guard_trg before update on public.%I for each row execute function private.guard_tenant_id_change()',t,t); end loop; end $$;

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
create or replace function private.guard_accounting_period() returns trigger language plpgsql set search_path='' as $period_guard$ begin if old.status='closed' and (new.name,new.start_date,new.end_date,new.status,new.closed_at) is distinct from (old.name,old.start_date,old.end_date,old.status,old.closed_at) then raise exception 'closed period is immutable'; end if; if old.status='open' and exists(select 1 from public.journal_entries where organization_id=old.organization_id and accounting_period_id=old.id and status='posted') and (new.name,new.start_date,new.end_date) is distinct from (old.name,old.start_date,old.end_date) then raise exception 'period with posted journals cannot change'; end if; if old.status='open' and new.status='closed' and new.closed_at is null then new.closed_at=now(); end if; return new; end; $period_guard$;
create trigger accounting_period_close_guard_trg before update on public.accounting_periods for each row execute function private.guard_accounting_period();

-- Invoice items can change only while their parent is draft.
create or replace function private.guard_draft_item() returns trigger language plpgsql set search_path='' as $$ declare s text; iid uuid; begin if tg_op='DELETE' then if tg_table_name='purchase_items' then iid=old.purchase_invoice_id; else iid=old.sales_invoice_id; end if; else if tg_table_name='purchase_items' then iid=new.purchase_invoice_id; else iid=new.sales_invoice_id; end if; end if; if tg_table_name='purchase_items' then select status into s from public.purchase_invoices where id=iid; else select status into s from public.sales_invoices where id=iid; end if; if s<>'draft' then raise exception 'items can only change while document is draft'; end if; if tg_op='DELETE' then return old; else return new; end if; end; $$;
create trigger purchase_items_draft_guard_trg before insert or update or delete on public.purchase_items for each row execute function private.guard_draft_item();
create trigger sales_items_draft_guard_trg before insert or update or delete on public.sales_items for each row execute function private.guard_draft_item();

-- Purchase posting: totals, discount allocation and return lineage.
create or replace function private.validate_purchase_post() returns trigger language plpgsql set search_path='' as $$ declare q numeric(30,8); gross numeric(30,8); dp numeric(30,16); x record; os text; returned numeric(30,8); begin if new.status<>'posted' then return new; end if; if tg_op='UPDATE' and old.status='posted' then return new; end if; select coalesce(sum(quantity),0),coalesce(sum(quantity*unit_cost),0) into q,gross from public.purchase_items where organization_id=new.organization_id and purchase_invoice_id=new.id; if q<=0 or round(gross,8)<>round(new.subtotal,8) then raise exception 'purchase lines do not match subtotal'; end if; dp=new.discount_amount/q; for x in select * from public.purchase_items where organization_id=new.organization_id and purchase_invoice_id=new.id loop if abs(x.discount_per_unit-dp)>0.00000000000001 or abs(x.net_unit_cost-(x.unit_cost-dp))>0.00000000000001 then raise exception 'purchase discount must be equal per unit'; end if; end loop; if round((select coalesce(sum(line_total),0) from public.purchase_items where organization_id=new.organization_id and purchase_invoice_id=new.id),8)<>round(new.total_amount,8) then raise exception 'purchase line totals do not match invoice total'; end if; if new.document_type='return' then if new.discount_amount<>0 then raise exception 'returns cannot introduce a new discount'; end if; select status into os from public.purchase_invoices where id=new.original_invoice_id and organization_id=new.organization_id; if os<>'posted' then raise exception 'return requires posted original purchase'; end if; if (select document_type from public.purchase_invoices where id=new.original_invoice_id and organization_id=new.organization_id)<>'purchase' then raise exception 'purchase return cannot target another return'; end if; if exists(select 1 from public.purchase_items ri where ri.purchase_invoice_id=new.id and ri.organization_id=new.organization_id and (select purchase_invoice_id from public.purchase_items oi where oi.id=ri.original_item_id and oi.organization_id=ri.organization_id)<>new.original_invoice_id) then raise exception 'purchase return item lineage mismatch'; end if; for x in select * from public.purchase_items where organization_id=new.organization_id and purchase_invoice_id=new.id loop if x.original_item_id is null or x.discount_per_unit<>0 or x.unit_cost<>(select net_unit_cost from public.purchase_items where organization_id=new.organization_id and id=x.original_item_id) then raise exception 'purchase return must reverse historical net cost'; end if; select coalesce(sum(ri.quantity),0) into returned from public.purchase_items ri join public.purchase_invoices r on r.id=ri.purchase_invoice_id and r.organization_id=ri.organization_id where ri.organization_id=new.organization_id and ri.original_item_id=x.original_item_id and r.document_type='return' and r.status='posted'; if returned+x.quantity>(select quantity from public.purchase_items where organization_id=new.organization_id and id=x.original_item_id) then raise exception 'purchase return exceeds original quantity'; end if; end loop; end if; return new; end; $$;
create trigger purchase_post_validation_trg before insert or update on public.purchase_invoices for each row execute function private.validate_purchase_post();

-- Sales posting: totals, discount allocation, COGS and return lineage.
create or replace function private.validate_sale_post() returns trigger language plpgsql set search_path='' as $$ declare q numeric(30,8); gross numeric(30,8); dp numeric(30,16); x record; os text; returned numeric(30,8); begin if new.status<>'posted' then return new; end if; if tg_op='UPDATE' and old.status='posted' then return new; end if; select coalesce(sum(quantity),0),coalesce(sum(quantity*unit_price),0) into q,gross from public.sales_items where organization_id=new.organization_id and sales_invoice_id=new.id; if q<=0 or round(gross,8)<>round(new.subtotal,8) then raise exception 'sales lines do not match subtotal'; end if; dp=new.discount_amount/q; for x in select * from public.sales_items where organization_id=new.organization_id and sales_invoice_id=new.id loop if x.cogs_unit_cost is null or x.cogs_total is null then raise exception 'sale requires historical COGS at posting'; end if; if abs(x.discount_per_unit-dp)>0.00000000000001 or abs(x.net_unit_price-(x.unit_price-dp))>0.00000000000001 then raise exception 'sales discount must be equal per unit'; end if; end loop; if round((select coalesce(sum(line_total),0) from public.sales_items where organization_id=new.organization_id and sales_invoice_id=new.id),8)<>round(new.total_amount,8) then raise exception 'sales line totals do not match invoice total'; end if; if new.document_type='return' then if new.discount_amount<>0 then raise exception 'returns cannot introduce a new discount'; end if; select status into os from public.sales_invoices where id=new.original_invoice_id and organization_id=new.organization_id; if os<>'posted' then raise exception 'return requires posted original sale'; end if; if (select document_type from public.sales_invoices where id=new.original_invoice_id and organization_id=new.organization_id)<>'sale' then raise exception 'sales return cannot target another return'; end if; if exists(select 1 from public.sales_items ri where ri.sales_invoice_id=new.id and ri.organization_id=new.organization_id and (select sales_invoice_id from public.sales_items oi where oi.id=ri.original_item_id and oi.organization_id=ri.organization_id)<>new.original_invoice_id) then raise exception 'sales return item lineage mismatch'; end if; for x in select * from public.sales_items where organization_id=new.organization_id and sales_invoice_id=new.id loop if x.original_item_id is null or x.discount_per_unit<>0 or x.unit_price<>(select net_unit_price from public.sales_items where organization_id=new.organization_id and id=x.original_item_id) or x.cogs_unit_cost<>(select cogs_unit_cost from public.sales_items where organization_id=new.organization_id and id=x.original_item_id) then raise exception 'sales return must reverse historical price and COGS'; end if; select coalesce(sum(ri.quantity),0) into returned from public.sales_items ri join public.sales_invoices r on r.id=ri.sales_invoice_id and r.organization_id=ri.organization_id where ri.organization_id=new.organization_id and ri.original_item_id=x.original_item_id and r.document_type='return' and r.status='posted'; if returned+x.quantity>(select quantity from public.sales_items where organization_id=new.organization_id and id=x.original_item_id) then raise exception 'sales return exceeds original quantity'; end if; end loop; end if; return new; end; $$;
create trigger sales_post_validation_trg before insert or update on public.sales_invoices for each row execute function private.validate_sale_post();

-- Payment allocation: posted target and allocation ceiling.
create or replace function private.validate_payment_allocation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  pa numeric(30,8);
  ps text;
  pt text;
  allocated numeric(30,8);
  doc_allocated numeric(30,8);
  doc_total numeric(30,8);
  doc_contact uuid;
  doc_account uuid;
  payment_settlement_account uuid;
  doc_status text;
begin
  select amount,status,payment_type,settlement_account_id
    into pa,ps,pt,payment_settlement_account
  from public.payments
  where id=new.payment_id and organization_id=new.organization_id
  for update;

  if ps is null then raise exception 'payment not found'; end if;
  if ps<>'posted' then raise exception 'payment must be posted before allocation'; end if;

  if pt='receipt' and new.document_type<>'sale' then raise exception 'receipt allocation type mismatch'; end if;
  if pt='payment' and new.document_type not in('purchase','expense') then raise exception 'payment allocation type mismatch'; end if;
  if pt='refund_in' and new.document_type<>'purchase_return' then raise exception 'refund_in allocation type mismatch'; end if;
  if pt='refund_out' and new.document_type<>'sale_return' then raise exception 'refund_out allocation type mismatch'; end if;

  if new.document_type in('purchase','purchase_return') then
    select status,total_amount,supplier_id,payable_account_id
      into doc_status,doc_total,doc_contact,doc_account
    from public.purchase_invoices
    where id=new.document_id and organization_id=new.organization_id
    for update;
  elsif new.document_type in('sale','sale_return') then
    select status,total_amount,customer_id,receivable_account_id
      into doc_status,doc_total,doc_contact,doc_account
    from public.sales_invoices
    where id=new.document_id and organization_id=new.organization_id
    for update;
  else
    select status,amount,contact_id,payable_account_id
      into doc_status,doc_total,doc_contact,doc_account
    from public.expenses
    where id=new.document_id and organization_id=new.organization_id
    for update;
  end if;

  if doc_status is distinct from 'posted' then
    raise exception 'allocation target must be posted';
  end if;
  if payment_settlement_account is null or doc_account is null or payment_settlement_account is distinct from doc_account then
    raise exception 'payment settlement account does not match document settlement account';
  end if;

  if (select contact_id from public.payments where id=new.payment_id and organization_id=new.organization_id)
     is distinct from doc_contact
  then
    raise exception 'payment contact does not match allocation target';
  end if;

  select coalesce(sum(allocated_amount),0)
    into allocated
  from public.payment_allocations
  where organization_id=new.organization_id
    and payment_id=new.payment_id
    and id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);

  if allocated+new.allocated_amount>pa then
    raise exception 'payment allocations exceed payment amount';
  end if;

  select coalesce(sum(allocated_amount),0)
    into doc_allocated
  from public.payment_allocations
  where organization_id=new.organization_id
    and document_type=new.document_type
    and document_id=new.document_id
    and id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);

  if doc_allocated+new.allocated_amount>doc_total then
    raise exception 'document allocations exceed document amount';
  end if;

  return new;
end;
$$;

-- =============================================================================
-- TRANSACTIONAL POSTING / RPC LAYER
-- =============================================================================
-- All financial/inventory mutations below are SECURITY DEFINER database
-- operations. They execute atomically: an exception rolls back the complete
-- posting, including document status, inventory state, inventory ledger,
-- journal header/lines, and payment allocations.
-- =============================================================================

create unique index journal_entries_one_reversal_uq
  on public.journal_entries(organization_id,reversal_of_id)
  where reversal_of_id is not null;

create or replace function private.next_number(p_org_id uuid,p_document_type text)
returns text
language plpgsql
security definer
set search_path=''
as $next_number$
declare
  v_prefix text;
  v_next bigint;
  v_padding integer;
begin
  if not private.has_org_role(p_org_id,array['owner','admin','manager','staff']) then
    raise exception 'not authorized for organization';
  end if;

  select prefix,next_number,padding
    into v_prefix,v_next,v_padding
  from public.number_sequences
  where organization_id=p_org_id and document_type=p_document_type and is_active
  for update;

  if not found then
    insert into public.number_sequences(organization_id,document_type,prefix,next_number,padding)
    values(p_org_id,p_document_type,case p_document_type
      when 'journal' then 'JE-'
      when 'inventory' then 'INV-'
      when 'product' then 'PRD-'
      when 'contact' then 'CON-'
      when 'purchase' then 'PUR-'
      when 'sale' then 'SAL-'
      when 'expense' then 'EXP-'
      when 'payment' then 'PAY-'
      else upper(left(p_document_type,3))||'-'
    end,1,6)
    on conflict(organization_id,document_type) do nothing;

    select prefix,next_number,padding
      into v_prefix,v_next,v_padding
    from public.number_sequences
    where organization_id=p_org_id and document_type=p_document_type
    for update;
  end if;

    update public.number_sequences
  set next_number=v_next+1
  where organization_id=p_org_id and document_type=p_document_type;

  return v_prefix||lpad(v_next::text,v_padding,'0');
end;
$next_number$;
-- Automatic business-number assignment for master/document records.
-- Users never supply these identifiers; the database allocates them atomically.
create or replace function private.assign_business_number()
returns trigger
language plpgsql
security definer
set search_path=''
as $assign_business_number$
begin
  if tg_table_name='products' then
    new.product_code:=private.next_number(new.organization_id,'product');
  elsif tg_table_name='contacts' then
    new.contact_number:=private.next_number(new.organization_id,'contact');
  elsif tg_table_name='purchase_invoices' then
    new.invoice_number:=private.next_number(new.organization_id,'purchase');
  elsif tg_table_name='sales_invoices' then
    new.invoice_number:=private.next_number(new.organization_id,'sale');
  elsif tg_table_name='expenses' then
    new.expense_number:=private.next_number(new.organization_id,'expense');
  elsif tg_table_name='payments' then
    new.payment_number:=private.next_number(new.organization_id,'payment');
  end if;
  return new;
end;
$assign_business_number$;

-- Business numbers are assigned before insert so every newly-created record
-- receives a tenant-scoped, concurrency-safe identifier automatically.
create trigger products_assign_number_trg
before insert on public.products
for each row execute function private.assign_business_number();
create trigger contacts_assign_number_trg
before insert on public.contacts
for each row execute function private.assign_business_number();
create trigger purchase_invoices_assign_number_trg
before insert on public.purchase_invoices
for each row execute function private.assign_business_number();
create trigger sales_invoices_assign_number_trg
before insert on public.sales_invoices
for each row execute function private.assign_business_number();
create trigger expenses_assign_number_trg
before insert on public.expenses
for each row execute function private.assign_business_number();
create trigger payments_assign_number_trg
before insert on public.payments
for each row execute function private.assign_business_number();

create or replace function private.require_postable_account(
  p_org_id uuid,
  p_account_id uuid,
  p_expected_type text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_type text;
begin
  select account_type
    into v_type
  from public.accounts
  where id=p_account_id
    and organization_id=p_org_id
    and is_active
    and is_postable;

  if v_type is null then
    raise exception 'account is not active/postable';
  end if;

  if p_expected_type is not null and v_type<>p_expected_type then
    raise exception 'account type mismatch: expected %, got %',p_expected_type,v_type;
  end if;
end;
$$;

create or replace function private.open_period_for_date(
  p_org_id uuid,
  p_date date
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_period uuid;
begin
  select id into v_period
  from public.accounting_periods
  where organization_id=p_org_id
    and status='open'
    and p_date between start_date and end_date;

  if v_period is null then
    raise exception 'no open accounting period covers %',p_date;
  end if;

  return v_period;
end;
$$;

create or replace function private.create_posted_journal(
  p_org_id uuid,
  p_date date,
  p_entry_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_description text,
  p_lines jsonb,
  p_reversal_of_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_journal_id uuid;
  v_period_id uuid;
  v_entry_number text;
  v_line record;
  v_count integer:=0;
begin
  v_period_id:=private.open_period_for_date(p_org_id,p_date);
  v_entry_number:=private.next_number(p_org_id,'journal');

  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then
    raise exception 'journal requires at least two lines';
  end if;

  insert into public.journal_entries(
    organization_id,entry_number,accounting_period_id,entry_date,
    entry_type,status,reference_type,reference_id,description,
    reversal_of_id,created_by
  )
  values(
    p_org_id,v_entry_number,v_period_id,p_date,
    p_entry_type,'draft',p_reference_type,p_reference_id,p_description,
    p_reversal_of_id,(select auth.uid())
  )
  returning id into v_journal_id;

  for v_line in
    select *
    from jsonb_to_recordset(p_lines) as x(
      account_id uuid,
      debit numeric,
      credit numeric,
      description text,
      contact_id uuid
    )
  loop
    v_count:=v_count+1;

    if coalesce(v_line.debit,0)<0 or coalesce(v_line.credit,0)<0
       or ((coalesce(v_line.debit,0)=0)=(coalesce(v_line.credit,0)=0))
    then
      raise exception 'invalid journal line %',v_count;
    end if;

    insert into public.account_transactions(
      organization_id,journal_entry_id,account_id,line_number,
      description,debit,credit,contact_id
    )
    values(
      p_org_id,v_journal_id,v_line.account_id,v_count,
      v_line.description,coalesce(v_line.debit,0),
      coalesce(v_line.credit,0),v_line.contact_id
    );
  end loop;

  update public.journal_entries
  set status='posted'
  where id=v_journal_id and organization_id=p_org_id;

  return v_journal_id;
end;
$$;

-- Strengthen direct document posting: only a matching posted journal may post a
-- business document. This prevents an authenticated client from posting a
-- document by merely changing status through the table policy.
create or replace function private.guard_posted_document()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_journal_status text;
  v_ref_type text;
  v_entry_type text;
  v_settlement_account_id uuid;
  v_expected_type text;
begin
  if tg_op='DELETE' then
    if old.status='posted' then
      raise exception 'posted documents cannot be deleted';
    end if;
    return old;
  end if;

  if old.status='posted' then
    raise exception 'posted documents cannot be modified';
  end if;

  if old.status='cancelled' and new.status<>'cancelled' then
    raise exception 'cancelled documents cannot be reopened';
  end if;

  if new.status='draft' and new.posted_journal_entry_id is not null then
    raise exception 'draft document cannot reference a posted journal';
  end if;

  if new.status='posted' then
    if new.posted_journal_entry_id is null then
      raise exception 'posted document requires posted_journal_entry_id';
    end if;

    select status,reference_type,entry_type
      into v_journal_status,v_ref_type,v_entry_type
    from public.journal_entries
    where id=new.posted_journal_entry_id
      and organization_id=new.organization_id;

    if v_journal_status<>'posted' then
      raise exception 'document journal must be posted';
    end if;

    if tg_table_name='purchase_invoices' then
      v_settlement_account_id:=new.payable_account_id;
      v_expected_type:='liability';
      if v_settlement_account_id is null then raise exception 'posted purchase requires payable account'; end if;
      perform private.require_postable_account(new.organization_id,v_settlement_account_id,v_expected_type);
      if new.document_type='return' and v_settlement_account_id is distinct from
         (select payable_account_id from public.purchase_invoices where id=new.original_invoice_id and organization_id=new.organization_id)
      then raise exception 'purchase return must use original payable account'; end if;
      v_ref_type:='purchase_invoice';
      if v_entry_type<>(case when new.document_type='return' then 'purchase_return' else 'purchase' end) then
        raise exception 'purchase journal entry type mismatch';
      end if;
    elsif tg_table_name='sales_invoices' then
      v_settlement_account_id:=new.receivable_account_id;
      v_expected_type:='asset';
      if v_settlement_account_id is null then raise exception 'posted sale requires receivable account'; end if;
      perform private.require_postable_account(new.organization_id,v_settlement_account_id,v_expected_type);
      if new.document_type='return' and v_settlement_account_id is distinct from
         (select receivable_account_id from public.sales_invoices where id=new.original_invoice_id and organization_id=new.organization_id)
      then raise exception 'sales return must use original receivable account'; end if;
      v_ref_type:='sales_invoice';
      if v_entry_type<>(case when new.document_type='return' then 'sale_return' else 'sale' end) then
        raise exception 'sales journal entry type mismatch';
      end if;
    elsif tg_table_name='expenses' then
      v_settlement_account_id:=new.payable_account_id;
      if v_settlement_account_id is null then raise exception 'posted expense requires payable account'; end if;
      perform private.require_postable_account(new.organization_id,v_settlement_account_id,'liability');
      v_ref_type:='expense';
      if v_entry_type<>'expense' then
        raise exception 'expense journal entry type mismatch';
      end if;
    elsif tg_table_name='payments' then
      v_settlement_account_id:=new.settlement_account_id;
      if v_settlement_account_id is null then raise exception 'posted payment requires settlement account'; end if;
      if new.payment_type in('receipt','refund_out') then
        perform private.require_postable_account(new.organization_id,v_settlement_account_id,'asset');
      else
        perform private.require_postable_account(new.organization_id,v_settlement_account_id,'liability');
      end if;
      v_ref_type:='payment';
      if v_entry_type not in('payment','refund') then
        raise exception 'payment journal entry type mismatch';
      end if;
    end if;

    if (select reference_type from public.journal_entries
        where id=new.posted_journal_entry_id
          and organization_id=new.organization_id)<>v_ref_type
       or
       (select reference_id from public.journal_entries
        where id=new.posted_journal_entry_id
          and organization_id=new.organization_id)<>new.id
    then
      raise exception 'document journal reference mismatch';
    end if;
  end if;

  return new;
end;
$$;

-- Purchase posting: inventory/AP and purchase-return/AP reversal.
create or replace function public.post_purchase_invoice(
  p_invoice_id uuid,
  p_payable_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_invoice public.purchase_invoices%rowtype;
  v_item record;
  v_balance public.inventory_balances%rowtype;
  v_journal_id uuid;
  v_lines jsonb:='[]'::jsonb;
  v_amount numeric(20,8);
  v_old_value numeric(20,8);
  v_new_qty numeric(20,8);
  v_new_value numeric(20,8);
  v_new_avg numeric(20,16);
  v_total numeric(20,8):=0;
begin
  select * into v_invoice
  from public.purchase_invoices
  where id=p_invoice_id
  for update;

  if not found then raise exception 'purchase invoice not found'; end if;
  if not private.has_org_role(v_invoice.organization_id,array['owner','admin','manager','staff']) then
    raise exception 'not authorized';
  end if;
  if v_invoice.status<>'draft' then raise exception 'purchase invoice is not draft'; end if;

  perform private.require_postable_account(v_invoice.organization_id,p_payable_account_id,'liability');

  if v_invoice.payable_account_id is null then v_invoice.payable_account_id:=p_payable_account_id; end if;
  if v_invoice.payable_account_id<>p_payable_account_id then raise exception 'purchase settlement account does not match historical mapping'; end if;

  if v_invoice.document_type='return' and v_invoice.original_invoice_id is null then
    raise exception 'purchase return requires original invoice';
  end if;

  if v_invoice.document_type='return' and not exists(
    select 1 from public.purchase_invoices
    where id=v_invoice.original_invoice_id
      and organization_id=v_invoice.organization_id
      and status='posted'
  ) then
    raise exception 'purchase return requires posted original invoice';
  end if;

  for v_item in
    select pi.*,p.inventory_account_id
    from public.purchase_items pi
    join public.products p on p.id=pi.product_id and p.organization_id=pi.organization_id
    where pi.purchase_invoice_id=v_invoice.id
      and pi.organization_id=v_invoice.organization_id
    order by pi.product_id,pi.line_number
  loop
    insert into public.inventory_balances(organization_id,product_id)
    values(v_invoice.organization_id,v_item.product_id)
    on conflict(organization_id,product_id) do nothing;

    select * into v_balance
    from public.inventory_balances
    where organization_id=v_invoice.organization_id and product_id=v_item.product_id
    for update;

    if v_invoice.document_type='purchase' then
      v_amount:=v_item.line_total;
      v_old_value:=v_balance.inventory_value;
      v_new_qty:=v_balance.quantity+v_item.quantity;
      v_new_value:=round(v_old_value+v_amount,8);
      v_new_avg:=case when v_new_qty=0 then 0 else v_new_value/v_new_qty end;

      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',v_item.inventory_account_id,
        'debit',v_amount,'credit',0,
        'description','Inventory receipt - '||v_item.line_number
      ));

      insert into public.inventory_transactions(
        organization_id,transaction_number,product_id,transaction_date,
        transaction_type,direction,quantity,unit_cost,total_value,
        reference_type,reference_id,unit_cost_before,average_cost_after,created_by
      )
      values(
        v_invoice.organization_id,private.next_number(v_invoice.organization_id,'inventory'),
        v_item.product_id,v_invoice.invoice_date,'purchase','in',
        v_item.quantity,v_item.net_unit_cost,v_amount,
        'purchase_invoice',v_invoice.id,v_balance.average_cost,v_new_avg,(select auth.uid())
      );
    else
      if v_item.original_item_id is null then raise exception 'purchase return line requires original_item_id'; end if;
      v_amount:=v_item.line_total;
      if v_item.quantity>v_balance.quantity then
        raise exception 'purchase return would make stock negative for product %',v_item.product_id;
      end if;
      v_old_value:=v_balance.inventory_value;
      v_new_qty:=v_balance.quantity-v_item.quantity;
      v_new_value:=round(v_old_value-v_amount,8);
      if v_new_value<0 then
        raise exception 'purchase return would make inventory value negative for product %',v_item.product_id;
      end if;
      v_new_avg:=case when v_new_qty=0 then 0 else v_new_value/v_new_qty end;

      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',v_item.inventory_account_id,
        'debit',0,'credit',v_amount,
        'description','Inventory return - '||v_item.line_number
      ));

      insert into public.inventory_transactions(
        organization_id,transaction_number,product_id,transaction_date,
        transaction_type,direction,quantity,unit_cost,total_value,
        reference_type,reference_id,unit_cost_before,average_cost_after,created_by
      )
      values(
        v_invoice.organization_id,private.next_number(v_invoice.organization_id,'inventory'),
        v_item.product_id,v_invoice.invoice_date,'purchase_return','out',
        v_item.quantity,v_item.net_unit_cost,v_amount,
        'purchase_invoice',v_invoice.id,v_balance.average_cost,v_new_avg,(select auth.uid())
      );
    end if;

    update public.inventory_balances
    set quantity=v_new_qty,average_cost=v_new_avg,
        inventory_value=v_new_value,updated_at=now()
    where id=v_balance.id;

    v_total:=v_total+v_amount;
  end loop;

  if v_total<>v_invoice.total_amount then
    raise exception 'purchase inventory total does not equal invoice total';
  end if;

  if v_invoice.document_type='purchase' then
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'account_id',p_payable_account_id,'debit',0,'credit',v_invoice.total_amount,
      'description','Accounts payable - '||v_invoice.invoice_number,
      'contact_id',v_invoice.supplier_id
    ));
    v_journal_id:=private.create_posted_journal(
      v_invoice.organization_id,v_invoice.invoice_date,'purchase',
      'purchase_invoice',v_invoice.id,'Purchase invoice '||v_invoice.invoice_number,v_lines
    );
  else
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'account_id',p_payable_account_id,'debit',v_invoice.total_amount,'credit',0,
      'description','Purchase return payable reversal - '||v_invoice.invoice_number,
      'contact_id',v_invoice.supplier_id
    ));
    v_journal_id:=private.create_posted_journal(
      v_invoice.organization_id,v_invoice.invoice_date,'purchase_return',
      'purchase_invoice',v_invoice.id,'Purchase return '||v_invoice.invoice_number,v_lines
    );
  end if;

  update public.purchase_invoices
  set payable_account_id=p_payable_account_id,
      posted_journal_entry_id=v_journal_id,status='posted'
  where id=v_invoice.id and organization_id=v_invoice.organization_id;

  return v_journal_id;
end;
$$;

-- Sales posting: WAC/COGS plus AR/revenue; sales returns reverse both.
create or replace function public.post_sales_invoice(
  p_invoice_id uuid,
  p_receivable_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_invoice public.sales_invoices%rowtype;
  v_group record;
  v_item record;
  v_balance public.inventory_balances%rowtype;
  v_journal_id uuid;
  v_lines jsonb:='[]'::jsonb;
  v_cogs numeric(20,8);
  v_total_cogs numeric(20,8):=0;
  v_qty numeric(20,8);
  v_new_qty numeric(20,8);
  v_new_value numeric(20,8);
  v_new_avg numeric(20,16);
  v_wac numeric(20,16);
  v_inventory_account uuid;
  v_cogs_account uuid;
  v_sales_account uuid;
begin
  select * into v_invoice
  from public.sales_invoices
  where id=p_invoice_id
  for update;

  if not found then raise exception 'sales invoice not found'; end if;
  if not private.has_org_role(v_invoice.organization_id,array['owner','admin','manager','staff']) then
    raise exception 'not authorized';
  end if;
  if v_invoice.status<>'draft' then raise exception 'sales invoice is not draft'; end if;

  perform private.require_postable_account(v_invoice.organization_id,p_receivable_account_id,'asset');

  if v_invoice.receivable_account_id is null then v_invoice.receivable_account_id:=p_receivable_account_id; end if;
  if v_invoice.receivable_account_id<>p_receivable_account_id then raise exception 'sales settlement account does not match historical mapping'; end if;

  if v_invoice.document_type='return' and not exists(
    select 1 from public.sales_invoices
    where id=v_invoice.original_invoice_id
      and organization_id=v_invoice.organization_id
      and status='posted'
  ) then
    raise exception 'sales return requires posted original invoice';
  end if;

  -- Normal sales: one WAC snapshot per product, even when the invoice has
  -- multiple lines for the same product.
  if v_invoice.document_type='sale' then
    for v_group in
      select product_id,sum(quantity) qty
      from public.sales_items
      where sales_invoice_id=v_invoice.id and organization_id=v_invoice.organization_id
      group by product_id
      order by product_id
    loop
      insert into public.inventory_balances(organization_id,product_id)
      values(v_invoice.organization_id,v_group.product_id)
      on conflict(organization_id,product_id) do nothing;

      select * into v_balance
      from public.inventory_balances
      where organization_id=v_invoice.organization_id and product_id=v_group.product_id
      for update;

      if v_group.qty>v_balance.quantity then
        raise exception 'insufficient stock for product %',v_group.product_id;
      end if;

      v_wac:=v_balance.average_cost;

      select inventory_account_id,cogs_account_id
        into v_inventory_account,v_cogs_account
      from public.products
      where id=v_group.product_id and organization_id=v_invoice.organization_id;

      for v_item in
        select * from public.sales_items
        where sales_invoice_id=v_invoice.id
          and organization_id=v_invoice.organization_id
          and product_id=v_group.product_id
        order by line_number
      loop
        v_cogs:=round(v_wac*v_item.quantity,8);
        update public.sales_items
        set cogs_unit_cost=v_wac,cogs_total=v_cogs
        where id=v_item.id and organization_id=v_invoice.organization_id;
        v_total_cogs:=v_total_cogs+v_cogs;
      end loop;

      v_new_qty:=v_balance.quantity-v_group.qty;
      v_new_value:=round(v_balance.inventory_value-(v_wac*v_group.qty),8);
      if v_new_value<0 then raise exception 'inventory value would become negative'; end if;
      v_new_avg:=case when v_new_qty=0 then 0 else v_new_value/v_new_qty end;

      insert into public.inventory_transactions(
        organization_id,transaction_number,product_id,transaction_date,
        transaction_type,direction,quantity,unit_cost,total_value,
        reference_type,reference_id,unit_cost_before,average_cost_after,created_by
      )
      values(
        v_invoice.organization_id,private.next_number(v_invoice.organization_id,'inventory'),
        v_group.product_id,v_invoice.invoice_date,'sale','out',
        v_group.qty,v_wac,round(v_wac*v_group.qty,8),
        'sales_invoice',v_invoice.id,v_balance.average_cost,v_new_avg,(select auth.uid())
      );

      v_lines:=v_lines||jsonb_build_array(
        jsonb_build_object('account_id',v_cogs_account,'debit',round(v_wac*v_group.qty,8),'credit',0,'description','COGS - '||v_group.product_id),
        jsonb_build_object('account_id',v_inventory_account,'debit',0,'credit',round(v_wac*v_group.qty,8),'description','Inventory relief - '||v_group.product_id)
      );

      update public.inventory_balances
      set quantity=v_new_qty,average_cost=v_new_avg,
          inventory_value=v_new_value,updated_at=now()
      where id=v_balance.id;
    end loop;
  else
    for v_group in
      select product_id,sum(quantity) qty
      from public.sales_items
      where sales_invoice_id=v_invoice.id and organization_id=v_invoice.organization_id
      group by product_id
      order by product_id
    loop
      v_total_cogs:=0;
      insert into public.inventory_balances(organization_id,product_id)
      values(v_invoice.organization_id,v_group.product_id)
      on conflict(organization_id,product_id) do nothing;

      select * into v_balance
      from public.inventory_balances
      where organization_id=v_invoice.organization_id and product_id=v_group.product_id
      for update;

      select inventory_account_id,cogs_account_id,sales_account_id
        into v_inventory_account,v_cogs_account,v_sales_account
      from public.products
      where id=v_group.product_id and organization_id=v_invoice.organization_id;

      v_new_qty:=v_balance.quantity;
      v_new_value:=v_balance.inventory_value;

      for v_item in
        select * from public.sales_items
        where sales_invoice_id=v_invoice.id
          and organization_id=v_invoice.organization_id
          and product_id=v_group.product_id
        order by line_number
      loop
        if v_item.cogs_unit_cost is null then
          raise exception 'sales return requires historical COGS';
        end if;

        v_cogs:=v_item.cogs_total;
        v_total_cogs:=v_total_cogs+v_cogs;
        v_new_qty:=v_new_qty+v_item.quantity;
        v_new_value:=round(v_new_value+v_cogs,8);
        v_new_avg:=case when v_new_qty=0 then 0 else v_new_value/v_new_qty end;

        insert into public.inventory_transactions(
          organization_id,transaction_number,product_id,transaction_date,
          transaction_type,direction,quantity,unit_cost,total_value,
          reference_type,reference_id,unit_cost_before,average_cost_after,created_by
        )
        values(
          v_invoice.organization_id,private.next_number(v_invoice.organization_id,'inventory'),
          v_group.product_id,v_invoice.invoice_date,'sale_return','in',
          v_item.quantity,v_item.cogs_unit_cost,v_cogs,
          'sales_invoice',v_invoice.id,v_balance.average_cost,v_new_avg,(select auth.uid())
        );

        v_balance.average_cost:=v_new_avg;
      end loop;

      v_lines:=v_lines||jsonb_build_array(
        jsonb_build_object('account_id',v_inventory_account,'debit',v_total_cogs,'credit',0,'description','Sales return inventory - '||v_group.product_id),
        jsonb_build_object('account_id',v_cogs_account,'debit',0,'credit',v_total_cogs,'description','Reverse COGS - '||v_group.product_id)
      );

      update public.inventory_balances
      set quantity=v_new_qty,average_cost=v_new_avg,
          inventory_value=v_new_value,updated_at=now()
      where id=v_balance.id;
    end loop;
  end if;

  if v_invoice.document_type='sale' then
    for v_item in
      select si.product_id,si.line_total,p.sales_account_id
      from public.sales_items si
      join public.products p on p.id=si.product_id and p.organization_id=si.organization_id
      where si.sales_invoice_id=v_invoice.id
      order by si.line_number
    loop
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',v_item.sales_account_id,'debit',0,'credit',v_item.line_total,
        'description','Sales revenue - '||v_item.product_id,
        'contact_id',v_invoice.customer_id
      ));
    end loop;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'account_id',p_receivable_account_id,'debit',v_invoice.total_amount,'credit',0,
      'description','Accounts receivable - '||v_invoice.invoice_number,
      'contact_id',v_invoice.customer_id
    ));
    v_journal_id:=private.create_posted_journal(
      v_invoice.organization_id,v_invoice.invoice_date,'sale',
      'sales_invoice',v_invoice.id,'Sales invoice '||v_invoice.invoice_number,v_lines
    );
  else
    for v_item in
      select si.product_id,si.line_total,p.sales_account_id
      from public.sales_items si
      join public.products p on p.id=si.product_id and p.organization_id=si.organization_id
      where si.sales_invoice_id=v_invoice.id
      order by si.line_number
    loop
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',v_item.sales_account_id,'debit',v_item.line_total,
        'credit',0,'description','Sales return revenue reversal - '||v_item.product_id,
        'contact_id',v_invoice.customer_id
      ));
    end loop;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'account_id',p_receivable_account_id,'debit',0,'credit',v_invoice.total_amount,
      'description','Accounts receivable return reversal - '||v_invoice.invoice_number,
      'contact_id',v_invoice.customer_id
    ));
    v_journal_id:=private.create_posted_journal(
      v_invoice.organization_id,v_invoice.invoice_date,'sale_return',
      'sales_invoice',v_invoice.id,'Sales return '||v_invoice.invoice_number,v_lines
    );
  end if;

  update public.sales_invoices
  set receivable_account_id=p_receivable_account_id,
      posted_journal_entry_id=v_journal_id,status='posted'
  where id=v_invoice.id and organization_id=v_invoice.organization_id;

  return v_journal_id;
end;
$$;

-- Expense posting: expense debit against a payable/cash/liability account.
create or replace function public.post_expense(
  p_expense_id uuid,
  p_credit_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_exp public.expenses%rowtype;
  v_expense_account uuid;
  v_journal_id uuid;
  v_lines jsonb;
begin
  select * into v_exp from public.expenses where id=p_expense_id for update;
  if not found then raise exception 'expense not found'; end if;
  if not private.has_org_role(v_exp.organization_id,array['owner','admin','manager','staff']) then raise exception 'not authorized'; end if;
  if v_exp.status<>'draft' then raise exception 'expense is not draft'; end if;
  if v_exp.payable_account_id is null then v_exp.payable_account_id:=p_credit_account_id; end if;
  if v_exp.payable_account_id<>p_credit_account_id then raise exception 'expense settlement account does not match historical mapping'; end if;

  select expense_account_id into v_expense_account
  from public.expense_categories
  where id=v_exp.expense_category_id and organization_id=v_exp.organization_id and is_active;

  if v_expense_account is null then raise exception 'expense category/account is inactive or missing'; end if;
  perform private.require_postable_account(v_exp.organization_id,v_expense_account,'expense');
  perform private.require_postable_account(v_exp.organization_id,p_credit_account_id,'liability');

  v_lines:=jsonb_build_array(
    jsonb_build_object('account_id',v_expense_account,'debit',v_exp.amount,'credit',0,'description',coalesce(v_exp.description,'Expense'),'contact_id',v_exp.contact_id),
    jsonb_build_object('account_id',p_credit_account_id,'debit',0,'credit',v_exp.amount,'description','Expense settlement','contact_id',v_exp.contact_id)
  );

  v_journal_id:=private.create_posted_journal(
    v_exp.organization_id,v_exp.expense_date,'expense',
    'expense',v_exp.id,'Expense '||v_exp.expense_number,v_lines
  );

  update public.expenses
  set payable_account_id=p_credit_account_id,
      posted_journal_entry_id=v_journal_id,status='posted'
  where id=v_exp.id and organization_id=v_exp.organization_id;

  return v_journal_id;
end;
$$;

-- Payment posting is atomic with its allocations. This avoids the classic
-- "payment posted first, allocation added later" race and lets the journal be
-- generated from the exact settlement event.
create or replace function public.post_payment(
  p_payment_id uuid,
  p_settlement_account_id uuid,
  p_allocations jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_payment public.payments%rowtype;
  v_alloc record;
  v_journal_id uuid;
  v_lines jsonb:='[]'::jsonb;
  v_allocated numeric(20,8):=0;
  v_remaining numeric(20,8);
  v_debit numeric(20,8):=0;
  v_credit numeric(20,8):=0;
  v_expected_type text;
  v_cash_side text;
begin
  select * into v_payment from public.payments where id=p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  if not private.has_org_role(v_payment.organization_id,array['owner','admin','manager','staff']) then raise exception 'not authorized'; end if;
  if v_payment.status<>'draft' then raise exception 'payment is not draft'; end if;
  if v_payment.settlement_account_id is null then v_payment.settlement_account_id:=p_settlement_account_id; end if;
  if v_payment.settlement_account_id<>p_settlement_account_id then raise exception 'payment settlement account does not match historical mapping'; end if;
  if jsonb_typeof(p_allocations)<>'array' then raise exception 'allocations must be a JSON array'; end if;

  perform private.require_postable_account(v_payment.organization_id,v_payment.account_id,'asset');

  if v_payment.payment_type in('receipt','refund_out') then
    v_expected_type:='asset';
  else
    v_expected_type:='liability';
  end if;
  perform private.require_postable_account(v_payment.organization_id,p_settlement_account_id,v_expected_type);

  if v_payment.payment_type in('receipt','payment') then
    v_cash_side:=case when v_payment.payment_type='receipt' then 'debit' else 'credit' end;
  else
    v_cash_side:=case when v_payment.payment_type='refund_in' then 'debit' else 'credit' end;
  end if;

  if v_cash_side='debit' then
    v_lines:=jsonb_build_array(jsonb_build_object(
      'account_id',v_payment.account_id,'debit',v_payment.amount,'credit',0,
      'description','Cash/bank receipt '||v_payment.payment_number,'contact_id',v_payment.contact_id
    ));
  else
    v_lines:=jsonb_build_array(jsonb_build_object(
      'account_id',v_payment.account_id,'debit',0,'credit',v_payment.amount,
      'description','Cash/bank payment '||v_payment.payment_number,'contact_id',v_payment.contact_id
    ));
  end if;

  for v_alloc in
    select *
    from jsonb_to_recordset(p_allocations) as x(
      document_type text,
      document_id uuid,
      allocated_amount numeric
    )
  loop
    if v_alloc.allocated_amount is null or v_alloc.allocated_amount<=0 then
      raise exception 'allocation amount must be positive';
    end if;

    if v_payment.payment_type='receipt' and v_alloc.document_type<>'sale' then
      raise exception 'receipt can allocate only to sales invoices';
    elsif v_payment.payment_type='payment' and v_alloc.document_type not in('purchase','expense') then
      raise exception 'payment can allocate only to purchase invoices or expenses';
    elsif v_payment.payment_type='refund_in' and v_alloc.document_type<>'purchase_return' then
      raise exception 'refund_in can allocate only to purchase returns';
    elsif v_payment.payment_type='refund_out' and v_alloc.document_type<>'sale_return' then
      raise exception 'refund_out can allocate only to sales returns';
    end if;

    v_allocated:=v_allocated+v_alloc.allocated_amount;

    if v_payment.payment_type in('receipt','refund_in') then
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',p_settlement_account_id,'debit',0,'credit',v_alloc.allocated_amount,
        'description','Settlement allocation - '||v_alloc.document_type,
        'contact_id',v_payment.contact_id
      ));
    else
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',p_settlement_account_id,'debit',v_alloc.allocated_amount,'credit',0,
        'description','Settlement allocation - '||v_alloc.document_type,
        'contact_id',v_payment.contact_id
      ));
    end if;
  end loop;

  if v_allocated>v_payment.amount then
    raise exception 'payment allocations exceed payment amount';
  end if;

  v_remaining:=round(v_payment.amount-v_allocated,8);
  if v_remaining>0 then
    if v_cash_side='debit' then
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',p_settlement_account_id,'debit',0,'credit',v_remaining,
        'description','Unallocated settlement balance','contact_id',v_payment.contact_id
      ));
    else
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',p_settlement_account_id,'debit',v_remaining,'credit',0,
        'description','Unallocated settlement balance','contact_id',v_payment.contact_id
      ));
    end if;
  end if;

  v_journal_id:=private.create_posted_journal(
    v_payment.organization_id,v_payment.payment_date,
    case when v_payment.payment_type in('refund_in','refund_out') then 'refund' else 'payment' end,
    'payment',v_payment.id,'Payment '||v_payment.payment_number,v_lines
  );

  update public.payments
  set settlement_account_id=p_settlement_account_id,
      posted_journal_entry_id=v_journal_id,status='posted'
  where id=v_payment.id and organization_id=v_payment.organization_id;

  -- Allocation trigger revalidates document status, compatibility and ceiling.
  for v_alloc in
    select *
    from jsonb_to_recordset(p_allocations) as x(
      document_type text,
      document_id uuid,
      allocated_amount numeric
    )
  loop
    insert into public.payment_allocations(
      organization_id,payment_id,document_type,document_id,allocated_amount
    )
    values(
      v_payment.organization_id,v_payment.id,
      v_alloc.document_type,v_alloc.document_id,v_alloc.allocated_amount
    );
  end loop;

  return v_journal_id;
end;
$$;

-- Manual/opening journal entry. Owner/admin only; still passes the same
-- period, account, balance and immutability gates as operational journals.
create or replace function public.post_manual_journal(
  p_org_id uuid,
  p_entry_date date,
  p_description text,
  p_lines jsonb,
  p_entry_type text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_journal_id uuid;
begin
  if not private.has_org_role(p_org_id,array['owner','admin']) then
    raise exception 'not authorized';
  end if;
  if p_entry_type not in('manual','opening') then
    raise exception 'manual journal entry type is invalid';
  end if;

  v_journal_id:=private.create_posted_journal(
    p_org_id,p_entry_date,p_entry_type,null,null,p_description,p_lines
  );
  return v_journal_id;
end;
$$;

-- Reverse a posted journal into the current open period. The original remains
-- untouched; the reversal is a new immutable posted journal.
create or replace function public.reverse_journal(
  p_journal_id uuid,
  p_reversal_date date,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_original public.journal_entries%rowtype;
  v_new_id uuid;
  v_lines jsonb:='[]'::jsonb;
  v_line record;
  v_period_id uuid;
  v_entry_number text;
begin
  select * into v_original
  from public.journal_entries
  where id=p_journal_id
  for update;

  if not found then raise exception 'journal not found'; end if;
  if not private.has_org_role(v_original.organization_id,array['owner','admin']) then raise exception 'not authorized'; end if;
  if v_original.status<>'posted' then raise exception 'only posted journals can be reversed'; end if;
  if v_original.entry_type not in('manual','opening') then
    raise exception 'operational journals must be corrected by their document workflow, not direct journal reversal';
  end if;
  if exists(select 1 from public.journal_entries where organization_id=v_original.organization_id and reversal_of_id=v_original.id) then
    raise exception 'journal has already been reversed';
  end if;

  v_period_id:=private.open_period_for_date(v_original.organization_id,p_reversal_date);
  v_entry_number:=private.next_number(v_original.organization_id,'journal');

  insert into public.journal_entries(
    organization_id,entry_number,accounting_period_id,entry_date,
    entry_type,status,reference_type,reference_id,description,
    reversal_of_id,created_by
  )
  values(
    v_original.organization_id,v_entry_number,v_period_id,p_reversal_date,
    'reversal','draft','journal_entry',v_original.id,
    coalesce(p_description,'Reversal of '||v_original.entry_number),
    v_original.id,(select auth.uid())
  )
  returning id into v_new_id;

  for v_line in
    select * from public.account_transactions
    where organization_id=v_original.organization_id
      and journal_entry_id=v_original.id
    order by line_number
  loop
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'account_id',v_line.account_id,
      'debit',v_line.credit,
      'credit',v_line.debit,
      'description','Reversal of line '||v_line.line_number,
      'contact_id',v_line.contact_id
    ));
  end loop;

  -- Reuse the already-created header rather than creating a second header.
  for v_line in
    select *
    from jsonb_to_recordset(v_lines) as x(
      account_id uuid,debit numeric,credit numeric,description text,contact_id uuid
    )
  loop
    insert into public.account_transactions(
      organization_id,journal_entry_id,account_id,line_number,
      description,debit,credit,contact_id
    )
    values(
      v_original.organization_id,v_new_id,
      v_line.account_id,
      (select coalesce(max(line_number),0)+1 from public.account_transactions where journal_entry_id=v_new_id),
      v_line.description,v_line.debit,v_line.credit,v_line.contact_id
    );
  end loop;

  update public.journal_entries set status='posted' where id=v_new_id;
  return v_new_id;
end;
$$;

-- Strengthen payment allocations with payment-type compatibility and a
-- document-level ceiling, not merely a payment-level ceiling.
create or replace function private.validate_payment_allocation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  pa numeric(30,8);
  ps text;
  pt text;
  allocated numeric(30,8);
  doc_allocated numeric(30,8);
  doc_total numeric(30,8);
  ok boolean:=false;
begin
  select amount,status,payment_type into pa,ps,pt
  from public.payments
  where id=new.payment_id and organization_id=new.organization_id
  for update;

  if ps is null then raise exception 'payment not found'; end if;
  if ps<>'posted' then raise exception 'payment must be posted before allocation'; end if;

  if pt='receipt' and new.document_type<>'sale' then raise exception 'receipt allocation type mismatch'; end if;
  if pt='payment' and new.document_type not in('purchase','expense') then raise exception 'payment allocation type mismatch'; end if;
  if pt='refund_in' and new.document_type<>'purchase_return' then raise exception 'refund_in allocation type mismatch'; end if;
  if pt='refund_out' and new.document_type<>'sale_return' then raise exception 'refund_out allocation type mismatch'; end if;

  if new.document_type in('purchase','purchase_return','expense') then
    if new.document_type='expense' then
      select exists(select 1 from public.expenses where id=new.document_id and organization_id=new.organization_id and status='posted'),
             coalesce((select amount from public.expenses where id=new.document_id and organization_id=new.organization_id),0)
        into ok,doc_total;
    else
      select exists(select 1 from public.purchase_invoices where id=new.document_id and organization_id=new.organization_id and status='posted'),
             coalesce((select total_amount from public.purchase_invoices where id=new.document_id and organization_id=new.organization_id),0)
        into ok,doc_total;
    end if;
  else
    select exists(select 1 from public.sales_invoices where id=new.document_id and organization_id=new.organization_id and status='posted'),
           coalesce((select total_amount from public.sales_invoices where id=new.document_id and organization_id=new.organization_id),0)
      into ok,doc_total;
  end if;

  if not ok then raise exception 'allocation target must be posted'; end if;

  if pt in('receipt','refund_out') and new.document_type in('sale','sale_return') then
    if (select customer_id from public.sales_invoices where id=new.document_id and organization_id=new.organization_id) is distinct from (select contact_id from public.payments where id=new.payment_id and organization_id=new.organization_id) then
      raise exception 'payment contact does not match sales customer';
    end if;
  elsif pt in('payment','refund_in') and new.document_type in('purchase','purchase_return') then
    if (select supplier_id from public.purchase_invoices where id=new.document_id and organization_id=new.organization_id) is distinct from (select contact_id from public.payments where id=new.payment_id and organization_id=new.organization_id) then
      raise exception 'payment contact does not match purchase supplier';
    end if;
  end if;

  select coalesce(sum(allocated_amount),0)
    into allocated
  from public.payment_allocations
  where organization_id=new.organization_id
    and payment_id=new.payment_id
    and id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);

  if allocated+new.allocated_amount>pa then
    raise exception 'payment allocations exceed payment amount';
  end if;

  select coalesce(sum(allocated_amount),0)
    into doc_allocated
  from public.payment_allocations
  where organization_id=new.organization_id
    and document_type=new.document_type
    and document_id=new.document_id
    and id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);

  if doc_allocated+new.allocated_amount>doc_total then
    raise exception 'document allocations exceed document amount';
  end if;

  return new;
end;
$$;

-- Private posting helpers are never part of the client API surface.
revoke all on function private.next_number(uuid,text) from public,authenticated;
revoke all on function private.assign_business_number() from public,authenticated;
revoke all on function private.require_postable_account(uuid,uuid,text) from public,authenticated;
revoke all on function private.open_period_for_date(uuid,date) from public,authenticated;
revoke all on function private.create_posted_journal(uuid,date,text,text,uuid,text,jsonb,uuid) from public,authenticated;
revoke all on function private.guard_posted_document() from public,authenticated;
revoke all on function private.validate_payment_allocation() from public,authenticated;
revoke all on function private.validate_purchase_post() from public,authenticated;
revoke all on function private.validate_sale_post() from public,authenticated;
revoke all on function private.validate_journal_post() from public,authenticated;

-- Posted payment allocations are settlement history and are immutable. A
-- correction is performed by reversing/replacing the payment event, not by
-- editing historical allocation rows.
create or replace function private.guard_payment_allocation_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'payment allocations are immutable';
end;
$$;
create trigger payment_allocations_validation_trg
before insert or update on public.payment_allocations
for each row execute function private.validate_payment_allocation();

revoke all on function private.guard_payment_allocation_mutation() from public,authenticated;
create trigger payment_allocations_immutable_trg
before update or delete on public.payment_allocations
for each row execute function private.guard_payment_allocation_mutation();

-- Public RPC execution boundary.
revoke all on function public.post_purchase_invoice(uuid,uuid) from public;
revoke all on function public.post_sales_invoice(uuid,uuid) from public;
revoke all on function public.post_expense(uuid,uuid) from public;
revoke all on function public.post_payment(uuid,uuid,jsonb) from public;
revoke all on function public.post_manual_journal(uuid,date,text,jsonb,text) from public;
revoke all on function public.reverse_journal(uuid,date,text) from public;

grant execute on function public.post_purchase_invoice(uuid,uuid) to authenticated;
grant execute on function public.post_sales_invoice(uuid,uuid) to authenticated;
grant execute on function public.post_expense(uuid,uuid) to authenticated;
grant execute on function public.post_payment(uuid,uuid,jsonb) to authenticated;
grant execute on function public.post_manual_journal(uuid,date,text,jsonb,text) to authenticated;
grant execute on function public.reverse_journal(uuid,date,text) to authenticated;

-- Anonymous clients must never reach privileged accounting/inventory posting RPCs.
-- Signed-in users remain the intended API caller; the functions retain their
-- SECURITY DEFINER boundary and perform their own organization/role checks.
revoke execute on function public.post_purchase_invoice(uuid,uuid) from anon;
revoke execute on function public.post_sales_invoice(uuid,uuid) from anon;
revoke execute on function public.post_expense(uuid,uuid) from anon;
revoke execute on function public.post_payment(uuid,uuid,jsonb) from anon;
revoke execute on function public.post_manual_journal(uuid,date,text,jsonb,text) from anon;
revoke execute on function public.reverse_journal(uuid,date,text) from anon;

-- RLS boundary for all 21 public tables.
do $$ declare t text; begin foreach t in array array['profiles','organizations','organization_users','units_of_measure','products','contacts','number_sequences','accounts','journal_entries','account_transactions','accounting_periods','purchase_invoices','purchase_items','sales_invoices','sales_items','inventory_balances','inventory_transactions','expense_categories','expenses','payments','payment_allocations'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on table public.%I from anon,authenticated',t); execute format('grant select on table public.%I to authenticated',t); end loop; end $$;

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
do $$
declare
  t text;
  v_roles text[] := array['owner','admin','manager','staff'];
  v_tables text[] := array['purchase_invoices','purchase_items','sales_invoices','sales_items','expenses','payments','payment_allocations'];
begin
  foreach t in array v_tables loop
    execute format(
      'create policy %I_write on public.%I for all to authenticated using ((select private.has_org_role(organization_id,%L::text[]))) with check ((select private.has_org_role(organization_id,%L::text[])))',
      t,t,v_roles,v_roles
    );
  end loop;
end $$;

grant select,insert,update on public.profiles to authenticated;
grant select,insert,update on public.organizations to authenticated;
grant select,insert,update,delete on public.organization_users to authenticated;
grant select,insert,update,delete on public.units_of_measure to authenticated;
grant select,insert,update on public.products,public.contacts to authenticated;
grant select on public.number_sequences to authenticated;
grant select,insert,update on public.accounts,public.accounting_periods to authenticated;
grant select on public.journal_entries,public.account_transactions,public.inventory_balances,public.inventory_transactions to authenticated;
grant select,insert,update,delete on public.purchase_invoices,public.purchase_items,public.sales_invoices,public.sales_items,public.expenses,public.payments,public.payment_allocations to authenticated;
));
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
create table public.journal_entries (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, entry_number text not null, accounting_period_id uuid not null, entry_date date not null, entry_type text not null check(entry_type in('manual','opening','purchase','purchase_return','sale','sale_return','payment','refund','expense','reversal')), status text not null default 'draft' check(status in('draft','posted')), reference_type text, reference_id uuid, description text, posted_at timestamptz, reversal_of_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,entry_number), constraint journal_entries_posted_state_ck check((status='posted' and posted_at is not null) or (status='draft' and posted_at is null)), foreign key(organization_id,accounting_period_id) references public.accounting_periods(organization_id,id), foreign key(organization_id,reversal_of_id) references public.journal_entries(organization_id,id), check((reference_type is null and reference_id is null) or(reference_type is not null and reference_id is not null)), check(reversal_of_id is null or(entry_type='reversal' and reversal_of_id<>id)));
-- Journal lines: individual debit/credit postings.
create table public.account_transactions (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, journal_entry_id uuid not null, account_id uuid not null, line_number integer not null, description text, debit numeric(20,8) not null default 0, credit numeric(20,8) not null default 0, contact_id uuid, created_at timestamptz not null default now(), unique(organization_id,journal_entry_id,line_number), foreign key(organization_id,journal_entry_id) references public.journal_entries(organization_id,id), foreign key(organization_id,account_id) references public.accounts(organization_id,id), foreign key(organization_id,contact_id) references public.contacts(organization_id,id), check(line_number>0), check(debit>=0 and credit>=0 and((debit>0 and credit=0)or(credit>0 and debit=0))));
-- Purchase documents and purchase returns share this table.
create table public.purchase_invoices (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, invoice_number text not null, document_type text not null default 'purchase' check(document_type in('purchase','return')), original_invoice_id uuid, supplier_id uuid not null, invoice_date date not null, status text not null default 'draft' check(status in('draft','posted','cancelled')), subtotal numeric(20,8) not null default 0, discount_amount numeric(20,8) not null default 0, total_amount numeric(20,8) not null default 0, payable_account_id uuid, posted_journal_entry_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,invoice_number), foreign key(organization_id,supplier_id) references public.contacts(organization_id,id), foreign key(organization_id,original_invoice_id) references public.purchase_invoices(organization_id,id), foreign key(organization_id,payable_account_id) references public.accounts(organization_id,id), foreign key(organization_id,posted_journal_entry_id) references public.journal_entries(organization_id,id), check(subtotal>=0 and discount_amount>=0 and total_amount>=0 and discount_amount<=subtotal and total_amount=subtotal-discount_amount), check((document_type='purchase' and original_invoice_id is null)or(document_type='return' and original_invoice_id is not null)), constraint purchase_invoices_posted_state_ck check((status='posted') = (posted_journal_entry_id is not null)));
-- Purchase lines preserve original price, allocated discount and effective cost.
create table public.purchase_items (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, purchase_invoice_id uuid not null, line_number integer not null, product_id uuid not null, original_item_id uuid, quantity numeric(20,8) not null, unit_cost numeric(20,16) not null, discount_per_unit numeric(20,16) not null default 0, net_unit_cost numeric(20,16) not null, line_total numeric(20,8) not null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,purchase_invoice_id,line_number), foreign key(organization_id,purchase_invoice_id) references public.purchase_invoices(organization_id,id), foreign key(organization_id,product_id) references public.products(organization_id,id), foreign key(organization_id,original_item_id) references public.purchase_items(organization_id,id), check(quantity>0), check(unit_cost>=0 and discount_per_unit>=0 and net_unit_cost>=0 and discount_per_unit<=unit_cost), check(net_unit_cost=unit_cost-discount_per_unit), check(line_total=round(net_unit_cost*quantity,8)));
-- Sales documents and sales returns share this table.
create table public.sales_invoices (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, invoice_number text not null, document_type text not null default 'sale' check(document_type in('sale','return')), original_invoice_id uuid, customer_id uuid not null, invoice_date date not null, status text not null default 'draft' check(status in('draft','posted','cancelled')), subtotal numeric(20,8) not null default 0, discount_amount numeric(20,8) not null default 0, total_amount numeric(20,8) not null default 0, receivable_account_id uuid, posted_journal_entry_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,invoice_number), foreign key(organization_id,customer_id) references public.contacts(organization_id,id), foreign key(organization_id,original_invoice_id) references public.sales_invoices(organization_id,id), foreign key(organization_id,receivable_account_id) references public.accounts(organization_id,id), foreign key(organization_id,posted_journal_entry_id) references public.journal_entries(organization_id,id), check(subtotal>=0 and discount_amount>=0 and total_amount>=0 and discount_amount<=subtotal and total_amount=subtotal-discount_amount), check((document_type='sale' and original_invoice_id is null)or(document_type='return' and original_invoice_id is not null)), constraint sales_invoices_posted_state_ck check((status='posted') = (posted_journal_entry_id is not null)));
-- Sales lines preserve net selling price and historical COGS.
create table public.sales_items (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, sales_invoice_id uuid not null, line_number integer not null, product_id uuid not null, original_item_id uuid, quantity numeric(20,8) not null, unit_price numeric(20,16) not null, discount_per_unit numeric(20,16) not null default 0, net_unit_price numeric(20,16) not null, line_total numeric(20,8) not null, cogs_unit_cost numeric(20,16), cogs_total numeric(20,8), created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,sales_invoice_id,line_number), foreign key(organization_id,sales_invoice_id) references public.sales_invoices(organization_id,id), foreign key(organization_id,product_id) references public.products(organization_id,id), foreign key(organization_id,original_item_id) references public.sales_items(organization_id,id), check(quantity>0), check(unit_price>=0 and discount_per_unit>=0 and net_unit_price>=0 and discount_per_unit<=unit_price), check(net_unit_price=unit_price-discount_per_unit), check(line_total=round(net_unit_price*quantity,8)), check(cogs_unit_cost is null or(cogs_unit_cost>=0 and cogs_total=round(cogs_unit_cost*quantity,8))));
-- Current materialized stock state per organization/product.
create table public.inventory_balances (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, product_id uuid not null, quantity numeric(20,8) not null default 0, average_cost numeric(20,16) not null default 0, inventory_value numeric(20,8) not null default 0, updated_at timestamptz not null default now(), unique(organization_id,product_id), foreign key(organization_id,product_id) references public.products(organization_id,id), check(quantity>=0 and average_cost>=0 and inventory_value>=0), check(inventory_value=round(quantity*average_cost,8)));
-- Immutable inventory movement ledger.
create table public.inventory_transactions (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, transaction_number text not null, product_id uuid not null, transaction_date date not null, transaction_type text not null check(transaction_type in('opening','purchase','purchase_return','sale','sale_return','adjustment')), direction text not null check(direction in('in','out')), quantity numeric(20,8) not null, unit_cost numeric(20,16) not null, total_value numeric(20,8) not null, reference_type text not null, reference_id uuid not null, unit_cost_before numeric(20,16), average_cost_after numeric(20,16) not null, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,transaction_number), foreign key(organization_id,product_id) references public.products(organization_id,id), check(quantity>0), check(unit_cost>=0 and total_value=round(unit_cost*quantity,8)), check(average_cost_after>=0), check(unit_cost_before is null or unit_cost_before>=0));
-- Non-stock operating-cost categories mapped to expense accounts.
create table public.expense_categories (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, category_code text not null, name text not null, expense_account_id uuid not null, is_active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,category_code), foreign key(organization_id,expense_account_id) references public.accounts(organization_id,id), check(btrim(category_code)<>''), check(btrim(name)<>''));
-- Operating expenses; these are not inventory products.
create table public.expenses (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, expense_number text not null, expense_category_id uuid not null, contact_id uuid, payable_account_id uuid, expense_date date not null, amount numeric(20,8) not null, description text, status text not null default 'draft' check(status in('draft','posted','cancelled')), posted_journal_entry_id uuid, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,expense_number), foreign key(organization_id,expense_category_id) references public.expense_categories(organization_id,id), foreign key(organization_id,contact_id) references public.contacts(organization_id,id), foreign key(organization_id,posted_journal_entry_id) references public.journal_entries(organization_id,id), check(amount>0), constraint expenses_posted_state_ck check((status='posted') = (posted_journal_entry_id is not null)));
-- Receipt/payment/refund events and their accounting references.
create table public.payments (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, payment_number text not null, payment_type text not null check(payment_type in('receipt','payment','refund_in','refund_out')), contact_id uuid, payment_date date not null, amount numeric(20,8) not null, account_id uuid not null, settlement_account_id uuid, status text not null default 'draft' check(status in('draft','posted','cancelled')), posted_journal_entry_id uuid, description text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,payment_number), foreign key(organization_id,contact_id) references public.contacts(organization_id,id), foreign key(organization_id,account_id) references public.accounts(organization_id,id), foreign key(organization_id,settlement_account_id) references public.accounts(organization_id,id), foreign key(organization_id,posted_journal_entry_id) references public.journal_entries(organization_id,id), check(amount>0), constraint payments_posted_state_ck check((status='posted') = (posted_journal_entry_id is not null)));
-- Allocation bridge between posted payments and posted documents.
create table public.payment_allocations (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, payment_id uuid not null, document_type text not null check(document_type in('purchase','purchase_return','sale','sale_return','expense')), document_id uuid not null, allocated_amount numeric(20,8) not null, created_at timestamptz not null default now(), foreign key(organization_id,payment_id) references public.payments(organization_id,id) on delete cascade, check(allocated_amount>0));

-- Reporting indexes.
create index journal_entries_period_idx on public.journal_entries(organization_id,accounting_period_id,entry_date);
create index account_transactions_account_idx on public.account_transactions(organization_id,account_id);
create index inventory_transactions_product_idx on public.inventory_transactions(organization_id,product_id,transaction_date,created_at);
create index payment_allocations_document_idx on public.payment_allocations(organization_id,document_type,document_id);
create index purchase_invoices_supplier_idx on public.purchase_invoices(organization_id,supplier_id,invoice_date);
create index purchase_items_product_idx on public.purchase_items(organization_id,product_id,purchase_invoice_id);
create index sales_invoices_customer_idx on public.sales_invoices(organization_id,customer_id,invoice_date);
create index sales_items_product_idx on public.sales_items(organization_id,product_id,sales_invoice_id);
create index expense_categories_account_idx on public.expense_categories(organization_id,expense_account_id);
create index expenses_category_idx on public.expenses(organization_id,expense_category_id,expense_date);
create index expenses_contact_idx on public.expenses(organization_id,contact_id,expense_date);
create index payments_contact_idx on public.payments(organization_id,contact_id,payment_date);
create index payments_account_idx on public.payments(organization_id,account_id,payment_date);

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

-- Never allow an organization to become ownerless through direct membership mutation.
create or replace function private.guard_last_owner_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $owner_guard$
begin
  if tg_op='DELETE'
     and old.role='owner'
     and old.is_active
     and not exists (
       select 1 from public.organization_users
       where organization_id=old.organization_id
         and role='owner' and is_active and id<>old.id
     ) then
    raise exception 'organization must retain an active owner';
  end if;

  if tg_op='UPDATE'
     and old.role='owner'
     and old.is_active
     and (new.role<>'owner' or not new.is_active)
     and not exists (
       select 1 from public.organization_users
       where organization_id=old.organization_id
         and role='owner' and is_active and id<>old.id
     ) then
    raise exception 'organization must retain an active owner';
  end if;

  return coalesce(new,old);
end;
$owner_guard$;
revoke all on function private.guard_last_owner_mutation() from public,authenticated;
create trigger organization_users_last_owner_guard_trg
before update or delete on public.organization_users
for each row execute function private.guard_last_owner_mutation();

-- Tenant-bound rows can never be moved between organizations.
create or replace function private.guard_tenant_id_change() returns trigger language plpgsql set search_path='' as $$ begin if tg_op='UPDATE' and old.organization_id is distinct from new.organization_id then raise exception 'organization_id cannot be changed'; end if; return new; end; $$;
revoke all on function private.guard_tenant_id_change() from public;
grant execute on function private.guard_tenant_id_change() to authenticated;
do $$ declare t text; begin foreach t in array array['organization_users','units_of_measure','accounting_periods','accounts','products','contacts','number_sequences','journal_entries','account_transactions','purchase_invoices','purchase_items','sales_invoices','sales_items','inventory_balances','inventory_transactions','expense_categories','expenses','payments','payment_allocations'] loop execute format('create trigger %I_tenant_guard_trg before update on public.%I for each row execute function private.guard_tenant_id_change()',t,t); end loop; end $$;

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
create or replace function private.guard_accounting_period() returns trigger language plpgsql set search_path='' as $period_guard$ begin if old.status='closed' and (new.name,new.start_date,new.end_date,new.status,new.closed_at) is distinct from (old.name,old.start_date,old.end_date,old.status,old.closed_at) then raise exception 'closed period is immutable'; end if; if old.status='open' and exists(select 1 from public.journal_entries where organization_id=old.organization_id and accounting_period_id=old.id and status='posted') and (new.name,new.start_date,new.end_date) is distinct from (old.name,old.start_date,old.end_date) then raise exception 'period with posted journals cannot change'; end if; if old.status='open' and new.status='closed' and new.closed_at is null then new.closed_at=now(); end if; return new; end; $period_guard$;
create trigger accounting_period_close_guard_trg before update on public.accounting_periods for each row execute function private.guard_accounting_period();

-- Invoice items can change only while their parent is draft.
create or replace function private.guard_draft_item() returns trigger language plpgsql set search_path='' as $$ declare s text; iid uuid; begin if tg_op='DELETE' then if tg_table_name='purchase_items' then iid=old.purchase_invoice_id; else iid=old.sales_invoice_id; end if; else if tg_table_name='purchase_items' then iid=new.purchase_invoice_id; else iid=new.sales_invoice_id; end if; end if; if tg_table_name='purchase_items' then select status into s from public.purchase_invoices where id=iid; else select status into s from public.sales_invoices where id=iid; end if; if s<>'draft' then raise exception 'items can only change while document is draft'; end if; if tg_op='DELETE' then return old; else return new; end if; end; $$;
create trigger purchase_items_draft_guard_trg before insert or update or delete on public.purchase_items for each row execute function private.guard_draft_item();
create trigger sales_items_draft_guard_trg before insert or update or delete on public.sales_items for each row execute function private.guard_draft_item();

-- Purchase posting: totals, discount allocation and return lineage.
create or replace function private.validate_purchase_post() returns trigger language plpgsql set search_path='' as $$ declare q numeric(30,8); gross numeric(30,8); dp numeric(30,16); x record; os text; returned numeric(30,8); begin if new.status<>'posted' then return new; end if; if tg_op='UPDATE' and old.status='posted' then return new; end if; select coalesce(sum(quantity),0),coalesce(sum(quantity*unit_cost),0) into q,gross from public.purchase_items where organization_id=new.organization_id and purchase_invoice_id=new.id; if q<=0 or round(gross,8)<>round(new.subtotal,8) then raise exception 'purchase lines do not match subtotal'; end if; dp=new.discount_amount/q; for x in select * from public.purchase_items where organization_id=new.organization_id and purchase_invoice_id=new.id loop if abs(x.discount_per_unit-dp)>0.00000000000001 or abs(x.net_unit_cost-(x.unit_cost-dp))>0.00000000000001 then raise exception 'purchase discount must be equal per unit'; end if; end loop; if round((select coalesce(sum(line_total),0) from public.purchase_items where organization_id=new.organization_id and purchase_invoice_id=new.id),8)<>round(new.total_amount,8) then raise exception 'purchase line totals do not match invoice total'; end if; if new.document_type='return' then if new.discount_amount<>0 then raise exception 'returns cannot introduce a new discount'; end if; select status into os from public.purchase_invoices where id=new.original_invoice_id and organization_id=new.organization_id; if os<>'posted' then raise exception 'return requires posted original purchase'; end if; if (select document_type from public.purchase_invoices where id=new.original_invoice_id and organization_id=new.organization_id)<>'purchase' then raise exception 'purchase return cannot target another return'; end if; if exists(select 1 from public.purchase_items ri where ri.purchase_invoice_id=new.id and ri.organization_id=new.organization_id and (select purchase_invoice_id from public.purchase_items oi where oi.id=ri.original_item_id and oi.organization_id=ri.organization_id)<>new.original_invoice_id) then raise exception 'purchase return item lineage mismatch'; end if; for x in select * from public.purchase_items where organization_id=new.organization_id and purchase_invoice_id=new.id loop if x.original_item_id is null or x.discount_per_unit<>0 or x.unit_cost<>(select net_unit_cost from public.purchase_items where organization_id=new.organization_id and id=x.original_item_id) then raise exception 'purchase return must reverse historical net cost'; end if; select coalesce(sum(ri.quantity),0) into returned from public.purchase_items ri join public.purchase_invoices r on r.id=ri.purchase_invoice_id and r.organization_id=ri.organization_id where ri.organization_id=new.organization_id and ri.original_item_id=x.original_item_id and r.document_type='return' and r.status='posted'; if returned+x.quantity>(select quantity from public.purchase_items where organization_id=new.organization_id and id=x.original_item_id) then raise exception 'purchase return exceeds original quantity'; end if; end loop; end if; return new; end; $$;
create trigger purchase_post_validation_trg before insert or update on public.purchase_invoices for each row execute function private.validate_purchase_post();

-- Sales posting: totals, discount allocation, COGS and return lineage.
create or replace function private.validate_sale_post() returns trigger language plpgsql set search_path='' as $$ declare q numeric(30,8); gross numeric(30,8); dp numeric(30,16); x record; os text; returned numeric(30,8); begin if new.status<>'posted' then return new; end if; if tg_op='UPDATE' and old.status='posted' then return new; end if; select coalesce(sum(quantity),0),coalesce(sum(quantity*unit_price),0) into q,gross from public.sales_items where organization_id=new.organization_id and sales_invoice_id=new.id; if q<=0 or round(gross,8)<>round(new.subtotal,8) then raise exception 'sales lines do not match subtotal'; end if; dp=new.discount_amount/q; for x in select * from public.sales_items where organization_id=new.organization_id and sales_invoice_id=new.id loop if x.cogs_unit_cost is null or x.cogs_total is null then raise exception 'sale requires historical COGS at posting'; end if; if abs(x.discount_per_unit-dp)>0.00000000000001 or abs(x.net_unit_price-(x.unit_price-dp))>0.00000000000001 then raise exception 'sales discount must be equal per unit'; end if; end loop; if round((select coalesce(sum(line_total),0) from public.sales_items where organization_id=new.organization_id and sales_invoice_id=new.id),8)<>round(new.total_amount,8) then raise exception 'sales line totals do not match invoice total'; end if; if new.document_type='return' then if new.discount_amount<>0 then raise exception 'returns cannot introduce a new discount'; end if; select status into os from public.sales_invoices where id=new.original_invoice_id and organization_id=new.organization_id; if os<>'posted' then raise exception 'return requires posted original sale'; end if; if (select document_type from public.sales_invoices where id=new.original_invoice_id and organization_id=new.organization_id)<>'sale' then raise exception 'sales return cannot target another return'; end if; if exists(select 1 from public.sales_items ri where ri.sales_invoice_id=new.id and ri.organization_id=new.organization_id and (select sales_invoice_id from public.sales_items oi where oi.id=ri.original_item_id and oi.organization_id=ri.organization_id)<>new.original_invoice_id) then raise exception 'sales return item lineage mismatch'; end if; for x in select * from public.sales_items where organization_id=new.organization_id and sales_invoice_id=new.id loop if x.original_item_id is null or x.discount_per_unit<>0 or x.unit_price<>(select net_unit_price from public.sales_items where organization_id=new.organization_id and id=x.original_item_id) or x.cogs_unit_cost<>(select cogs_unit_cost from public.sales_items where organization_id=new.organization_id and id=x.original_item_id) then raise exception 'sales return must reverse historical price and COGS'; end if; select coalesce(sum(ri.quantity),0) into returned from public.sales_items ri join public.sales_invoices r on r.id=ri.sales_invoice_id and r.organization_id=ri.organization_id where ri.organization_id=new.organization_id and ri.original_item_id=x.original_item_id and r.document_type='return' and r.status='posted'; if returned+x.quantity>(select quantity from public.sales_items where organization_id=new.organization_id and id=x.original_item_id) then raise exception 'sales return exceeds original quantity'; end if; end loop; end if; return new; end; $$;
create trigger sales_post_validation_trg before insert or update on public.sales_invoices for each row execute function private.validate_sale_post();

-- Payment allocation: posted target and allocation ceiling.
create or replace function private.validate_payment_allocation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  pa numeric(30,8);
  ps text;
  pt text;
  allocated numeric(30,8);
  doc_allocated numeric(30,8);
  doc_total numeric(30,8);
  doc_contact uuid;
  doc_account uuid;
  payment_settlement_account uuid;
  doc_status text;
begin
  select amount,status,payment_type,settlement_account_id
    into pa,ps,pt,payment_settlement_account
  from public.payments
  where id=new.payment_id and organization_id=new.organization_id
  for update;

  if ps is null then raise exception 'payment not found'; end if;
  if ps<>'posted' then raise exception 'payment must be posted before allocation'; end if;

  if pt='receipt' and new.document_type<>'sale' then raise exception 'receipt allocation type mismatch'; end if;
  if pt='payment' and new.document_type not in('purchase','expense') then raise exception 'payment allocation type mismatch'; end if;
  if pt='refund_in' and new.document_type<>'purchase_return' then raise exception 'refund_in allocation type mismatch'; end if;
  if pt='refund_out' and new.document_type<>'sale_return' then raise exception 'refund_out allocation type mismatch'; end if;

  if new.document_type in('purchase','purchase_return') then
    select status,total_amount,supplier_id,payable_account_id
      into doc_status,doc_total,doc_contact,doc_account
    from public.purchase_invoices
    where id=new.document_id and organization_id=new.organization_id
    for update;
  elsif new.document_type in('sale','sale_return') then
    select status,total_amount,customer_id,receivable_account_id
      into doc_status,doc_total,doc_contact,doc_account
    from public.sales_invoices
    where id=new.document_id and organization_id=new.organization_id
    for update;
  else
    select status,amount,contact_id,payable_account_id
      into doc_status,doc_total,doc_contact,doc_account
    from public.expenses
    where id=new.document_id and organization_id=new.organization_id
    for update;
  end if;

  if doc_status is distinct from 'posted' then
    raise exception 'allocation target must be posted';
  end if;
  if payment_settlement_account is null or doc_account is null or payment_settlement_account is distinct from doc_account then
    raise exception 'payment settlement account does not match document settlement account';
  end if;

  if (select contact_id from public.payments where id=new.payment_id and organization_id=new.organization_id)
     is distinct from doc_contact
  then
    raise exception 'payment contact does not match allocation target';
  end if;

  select coalesce(sum(allocated_amount),0)
    into allocated
  from public.payment_allocations
  where organization_id=new.organization_id
    and payment_id=new.payment_id
    and id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);

  if allocated+new.allocated_amount>pa then
    raise exception 'payment allocations exceed payment amount';
  end if;

  select coalesce(sum(allocated_amount),0)
    into doc_allocated
  from public.payment_allocations
  where organization_id=new.organization_id
    and document_type=new.document_type
    and document_id=new.document_id
    and id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);

  if doc_allocated+new.allocated_amount>doc_total then
    raise exception 'document allocations exceed document amount';
  end if;

  return new;
end;
$$;

-- =============================================================================
-- TRANSACTIONAL POSTING / RPC LAYER
-- =============================================================================
-- All financial/inventory mutations below are SECURITY DEFINER database
-- operations. They execute atomically: an exception rolls back the complete
-- posting, including document status, inventory state, inventory ledger,
-- journal header/lines, and payment allocations.
-- =============================================================================

create unique index journal_entries_one_reversal_uq
  on public.journal_entries(organization_id,reversal_of_id)
  where reversal_of_id is not null;

create or replace function private.next_number(p_org_id uuid,p_document_type text)
returns text
language plpgsql
security definer
set search_path=''
as $next_number$
declare
  v_prefix text;
  v_next bigint;
  v_padding integer;
begin
  if not private.has_org_role(p_org_id,array['owner','admin','manager','staff']) then
    raise exception 'not authorized for organization';
  end if;

  select prefix,next_number,padding
    into v_prefix,v_next,v_padding
  from public.number_sequences
  where organization_id=p_org_id and document_type=p_document_type and is_active
  for update;

  if not found then
    insert into public.number_sequences(organization_id,document_type,prefix,next_number,padding)
    values(p_org_id,p_document_type,case p_document_type
      when 'journal' then 'JE-'
      when 'inventory' then 'INV-'
      when 'product' then 'PRD-'
      when 'contact' then 'CON-'
      when 'purchase' then 'PUR-'
      when 'sale' then 'SAL-'
      when 'expense' then 'EXP-'
      when 'payment' then 'PAY-'
      else upper(left(p_document_type,3))||'-'
    end,1,6)
    on conflict(organization_id,document_type) do nothing;

    select prefix,next_number,padding
      into v_prefix,v_next,v_padding
    from public.number_sequences
    where organization_id=p_org_id and document_type=p_document_type
    for update;
  end if;

    update public.number_sequences
  set next_number=v_next+1
  where organization_id=p_org_id and document_type=p_document_type;

  return v_prefix||lpad(v_next::text,v_padding,'0');
end;
$next_number$;
create or replace function private.require_postable_account(
  p_org_id uuid,
  p_account_id uuid,
  p_expected_type text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_type text;
begin
  select account_type
    into v_type
  from public.accounts
  where id=p_account_id
    and organization_id=p_org_id
    and is_active
    and is_postable;

  if v_type is null then
    raise exception 'account is not active/postable';
  end if;

  if p_expected_type is not null and v_type<>p_expected_type then
    raise exception 'account type mismatch: expected %, got %',p_expected_type,v_type;
  end if;
end;
$$;

create or replace function private.open_period_for_date(
  p_org_id uuid,
  p_date date
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_period uuid;
begin
  select id into v_period
  from public.accounting_periods
  where organization_id=p_org_id
    and status='open'
    and p_date between start_date and end_date;

  if v_period is null then
    raise exception 'no open accounting period covers %',p_date;
  end if;

  return v_period;
end;
$$;

create or replace function private.create_posted_journal(
  p_org_id uuid,
  p_date date,
  p_entry_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_description text,
  p_lines jsonb,
  p_reversal_of_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_journal_id uuid;
  v_period_id uuid;
  v_entry_number text;
  v_line record;
  v_count integer:=0;
begin
  v_period_id:=private.open_period_for_date(p_org_id,p_date);
  v_entry_number:=private.next_number(p_org_id,'journal');

  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then
    raise exception 'journal requires at least two lines';
  end if;

  insert into public.journal_entries(
    organization_id,entry_number,accounting_period_id,entry_date,
    entry_type,status,reference_type,reference_id,description,
    reversal_of_id,created_by
  )
  values(
    p_org_id,v_entry_number,v_period_id,p_date,
    p_entry_type,'draft',p_reference_type,p_reference_id,p_description,
    p_reversal_of_id,(select auth.uid())
  )
  returning id into v_journal_id;

  for v_line in
    select *
    from jsonb_to_recordset(p_lines) as x(
      account_id uuid,
      debit numeric,
      credit numeric,
      description text,
      contact_id uuid
    )
  loop
    v_count:=v_count+1;

    if coalesce(v_line.debit,0)<0 or coalesce(v_line.credit,0)<0
       or ((coalesce(v_line.debit,0)=0)=(coalesce(v_line.credit,0)=0))
    then
      raise exception 'invalid journal line %',v_count;
    end if;

    insert into public.account_transactions(
      organization_id,journal_entry_id,account_id,line_number,
      description,debit,credit,contact_id
    )
    values(
      p_org_id,v_journal_id,v_line.account_id,v_count,
      v_line.description,coalesce(v_line.debit,0),
      coalesce(v_line.credit,0),v_line.contact_id
    );
  end loop;

  update public.journal_entries
  set status='posted'
  where id=v_journal_id and organization_id=p_org_id;

  return v_journal_id;
end;
$$;

-- Strengthen direct document posting: only a matching posted journal may post a
-- business document. This prevents an authenticated client from posting a
-- document by merely changing status through the table policy.
create or replace function private.guard_posted_document()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_journal_status text;
  v_ref_type text;
  v_entry_type text;
  v_settlement_account_id uuid;
  v_expected_type text;
begin
  if tg_op='DELETE' then
    if old.status='posted' then
      raise exception 'posted documents cannot be deleted';
    end if;
    return old;
  end if;

  if old.status='posted' then
    raise exception 'posted documents cannot be modified';
  end if;

  if old.status='cancelled' and new.status<>'cancelled' then
    raise exception 'cancelled documents cannot be reopened';
  end if;

  if new.status='draft' and new.posted_journal_entry_id is not null then
    raise exception 'draft document cannot reference a posted journal';
  end if;

  if new.status='posted' then
    if new.posted_journal_entry_id is null then
      raise exception 'posted document requires posted_journal_entry_id';
    end if;

    select status,reference_type,entry_type
      into v_journal_status,v_ref_type,v_entry_type
    from public.journal_entries
    where id=new.posted_journal_entry_id
      and organization_id=new.organization_id;

    if v_journal_status<>'posted' then
      raise exception 'document journal must be posted';
    end if;

    if tg_table_name='purchase_invoices' then
      v_settlement_account_id:=new.payable_account_id;
      v_expected_type:='liability';
      if v_settlement_account_id is null then raise exception 'posted purchase requires payable account'; end if;
      perform private.require_postable_account(new.organization_id,v_settlement_account_id,v_expected_type);
      if new.document_type='return' and v_settlement_account_id is distinct from
         (select payable_account_id from public.purchase_invoices where id=new.original_invoice_id and organization_id=new.organization_id)
      then raise exception 'purchase return must use original payable account'; end if;
      v_ref_type:='purchase_invoice';
      if v_entry_type<>(case when new.document_type='return' then 'purchase_return' else 'purchase' end) then
        raise exception 'purchase journal entry type mismatch';
      end if;
    elsif tg_table_name='sales_invoices' then
      v_settlement_account_id:=new.receivable_account_id;
      v_expected_type:='asset';
      if v_settlement_account_id is null then raise exception 'posted sale requires receivable account'; end if;
      perform private.require_postable_account(new.organization_id,v_settlement_account_id,v_expected_type);
      if new.document_type='return' and v_settlement_account_id is distinct from
         (select receivable_account_id from public.sales_invoices where id=new.original_invoice_id and organization_id=new.organization_id)
      then raise exception 'sales return must use original receivable account'; end if;
      v_ref_type:='sales_invoice';
      if v_entry_type<>(case when new.document_type='return' then 'sale_return' else 'sale' end) then
        raise exception 'sales journal entry type mismatch';
      end if;
    elsif tg_table_name='expenses' then
      v_settlement_account_id:=new.payable_account_id;
      if v_settlement_account_id is null then raise exception 'posted expense requires payable account'; end if;
      perform private.require_postable_account(new.organization_id,v_settlement_account_id,'liability');
      v_ref_type:='expense';
      if v_entry_type<>'expense' then
        raise exception 'expense journal entry type mismatch';
      end if;
    elsif tg_table_name='payments' then
      v_settlement_account_id:=new.settlement_account_id;
      if v_settlement_account_id is null then raise exception 'posted payment requires settlement account'; end if;
      if new.payment_type in('receipt','refund_out') then
        perform private.require_postable_account(new.organization_id,v_settlement_account_id,'asset');
      else
        perform private.require_postable_account(new.organization_id,v_settlement_account_id,'liability');
      end if;
      v_ref_type:='payment';
      if v_entry_type not in('payment','refund') then
        raise exception 'payment journal entry type mismatch';
      end if;
    end if;

    if (select reference_type from public.journal_entries
        where id=new.posted_journal_entry_id
          and organization_id=new.organization_id)<>v_ref_type
       or
       (select reference_id from public.journal_entries
        where id=new.posted_journal_entry_id
          and organization_id=new.organization_id)<>new.id
    then
      raise exception 'document journal reference mismatch';
    end if;
  end if;

  return new;
end;
$$;

-- Purchase posting: inventory/AP and purchase-return/AP reversal.
create or replace function public.post_purchase_invoice(
  p_invoice_id uuid,
  p_payable_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_invoice public.purchase_invoices%rowtype;
  v_item record;
  v_balance public.inventory_balances%rowtype;
  v_journal_id uuid;
  v_lines jsonb:='[]'::jsonb;
  v_amount numeric(20,8);
  v_old_value numeric(20,8);
  v_new_qty numeric(20,8);
  v_new_value numeric(20,8);
  v_new_avg numeric(20,16);
  v_total numeric(20,8):=0;
begin
  select * into v_invoice
  from public.purchase_invoices
  where id=p_invoice_id
  for update;

  if not found then raise exception 'purchase invoice not found'; end if;
  if not private.has_org_role(v_invoice.organization_id,array['owner','admin','manager','staff']) then
    raise exception 'not authorized';
  end if;
  if v_invoice.status<>'draft' then raise exception 'purchase invoice is not draft'; end if;

  perform private.require_postable_account(v_invoice.organization_id,p_payable_account_id,'liability');

  if v_invoice.payable_account_id is null then v_invoice.payable_account_id:=p_payable_account_id; end if;
  if v_invoice.payable_account_id<>p_payable_account_id then raise exception 'purchase settlement account does not match historical mapping'; end if;

  if v_invoice.document_type='return' and v_invoice.original_invoice_id is null then
    raise exception 'purchase return requires original invoice';
  end if;

  if v_invoice.document_type='return' and not exists(
    select 1 from public.purchase_invoices
    where id=v_invoice.original_invoice_id
      and organization_id=v_invoice.organization_id
      and status='posted'
  ) then
    raise exception 'purchase return requires posted original invoice';
  end if;

  for v_item in
    select pi.*,p.inventory_account_id
    from public.purchase_items pi
    join public.products p on p.id=pi.product_id and p.organization_id=pi.organization_id
    where pi.purchase_invoice_id=v_invoice.id
      and pi.organization_id=v_invoice.organization_id
    order by pi.product_id,pi.line_number
  loop
    insert into public.inventory_balances(organization_id,product_id)
    values(v_invoice.organization_id,v_item.product_id)
    on conflict(organization_id,product_id) do nothing;

    select * into v_balance
    from public.inventory_balances
    where organization_id=v_invoice.organization_id and product_id=v_item.product_id
    for update;

    if v_invoice.document_type='purchase' then
      v_amount:=v_item.line_total;
      v_old_value:=v_balance.inventory_value;
      v_new_qty:=v_balance.quantity+v_item.quantity;
      v_new_value:=round(v_old_value+v_amount,8);
      v_new_avg:=case when v_new_qty=0 then 0 else v_new_value/v_new_qty end;

      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',v_item.inventory_account_id,
        'debit',v_amount,'credit',0,
        'description','Inventory receipt - '||v_item.line_number
      ));

      insert into public.inventory_transactions(
        organization_id,transaction_number,product_id,transaction_date,
        transaction_type,direction,quantity,unit_cost,total_value,
        reference_type,reference_id,unit_cost_before,average_cost_after,created_by
      )
      values(
        v_invoice.organization_id,private.next_number(v_invoice.organization_id,'inventory'),
        v_item.product_id,v_invoice.invoice_date,'purchase','in',
        v_item.quantity,v_item.net_unit_cost,v_amount,
        'purchase_invoice',v_invoice.id,v_balance.average_cost,v_new_avg,(select auth.uid())
      );
    else
      if v_item.original_item_id is null then raise exception 'purchase return line requires original_item_id'; end if;
      v_amount:=v_item.line_total;
      if v_item.quantity>v_balance.quantity then
        raise exception 'purchase return would make stock negative for product %',v_item.product_id;
      end if;
      v_old_value:=v_balance.inventory_value;
      v_new_qty:=v_balance.quantity-v_item.quantity;
      v_new_value:=round(v_old_value-v_amount,8);
      if v_new_value<0 then
        raise exception 'purchase return would make inventory value negative for product %',v_item.product_id;
      end if;
      v_new_avg:=case when v_new_qty=0 then 0 else v_new_value/v_new_qty end;

      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',v_item.inventory_account_id,
        'debit',0,'credit',v_amount,
        'description','Inventory return - '||v_item.line_number
      ));

      insert into public.inventory_transactions(
        organization_id,transaction_number,product_id,transaction_date,
        transaction_type,direction,quantity,unit_cost,total_value,
        reference_type,reference_id,unit_cost_before,average_cost_after,created_by
      )
      values(
        v_invoice.organization_id,private.next_number(v_invoice.organization_id,'inventory'),
        v_item.product_id,v_invoice.invoice_date,'purchase_return','out',
        v_item.quantity,v_item.net_unit_cost,v_amount,
        'purchase_invoice',v_invoice.id,v_balance.average_cost,v_new_avg,(select auth.uid())
      );
    end if;

    update public.inventory_balances
    set quantity=v_new_qty,average_cost=v_new_avg,
        inventory_value=v_new_value,updated_at=now()
    where id=v_balance.id;

    v_total:=v_total+v_amount;
  end loop;

  if v_total<>v_invoice.total_amount then
    raise exception 'purchase inventory total does not equal invoice total';
  end if;

  if v_invoice.document_type='purchase' then
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'account_id',p_payable_account_id,'debit',0,'credit',v_invoice.total_amount,
      'description','Accounts payable - '||v_invoice.invoice_number,
      'contact_id',v_invoice.supplier_id
    ));
    v_journal_id:=private.create_posted_journal(
      v_invoice.organization_id,v_invoice.invoice_date,'purchase',
      'purchase_invoice',v_invoice.id,'Purchase invoice '||v_invoice.invoice_number,v_lines
    );
  else
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'account_id',p_payable_account_id,'debit',v_invoice.total_amount,'credit',0,
      'description','Purchase return payable reversal - '||v_invoice.invoice_number,
      'contact_id',v_invoice.supplier_id
    ));
    v_journal_id:=private.create_posted_journal(
      v_invoice.organization_id,v_invoice.invoice_date,'purchase_return',
      'purchase_invoice',v_invoice.id,'Purchase return '||v_invoice.invoice_number,v_lines
    );
  end if;

  update public.purchase_invoices
  set payable_account_id=p_payable_account_id,
      posted_journal_entry_id=v_journal_id,status='posted'
  where id=v_invoice.id and organization_id=v_invoice.organization_id;

  return v_journal_id;
end;
$$;

-- Sales posting: WAC/COGS plus AR/revenue; sales returns reverse both.
create or replace function public.post_sales_invoice(
  p_invoice_id uuid,
  p_receivable_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_invoice public.sales_invoices%rowtype;
  v_group record;
  v_item record;
  v_balance public.inventory_balances%rowtype;
  v_journal_id uuid;
  v_lines jsonb:='[]'::jsonb;
  v_cogs numeric(20,8);
  v_total_cogs numeric(20,8):=0;
  v_qty numeric(20,8);
  v_new_qty numeric(20,8);
  v_new_value numeric(20,8);
  v_new_avg numeric(20,16);
  v_wac numeric(20,16);
  v_inventory_account uuid;
  v_cogs_account uuid;
  v_sales_account uuid;
begin
  select * into v_invoice
  from public.sales_invoices
  where id=p_invoice_id
  for update;

  if not found then raise exception 'sales invoice not found'; end if;
  if not private.has_org_role(v_invoice.organization_id,array['owner','admin','manager','staff']) then
    raise exception 'not authorized';
  end if;
  if v_invoice.status<>'draft' then raise exception 'sales invoice is not draft'; end if;

  perform private.require_postable_account(v_invoice.organization_id,p_receivable_account_id,'asset');

  if v_invoice.receivable_account_id is null then v_invoice.receivable_account_id:=p_receivable_account_id; end if;
  if v_invoice.receivable_account_id<>p_receivable_account_id then raise exception 'sales settlement account does not match historical mapping'; end if;

  if v_invoice.document_type='return' and not exists(
    select 1 from public.sales_invoices
    where id=v_invoice.original_invoice_id
      and organization_id=v_invoice.organization_id
      and status='posted'
  ) then
    raise exception 'sales return requires posted original invoice';
  end if;

  -- Normal sales: one WAC snapshot per product, even when the invoice has
  -- multiple lines for the same product.
  if v_invoice.document_type='sale' then
    for v_group in
      select product_id,sum(quantity) qty
      from public.sales_items
      where sales_invoice_id=v_invoice.id and organization_id=v_invoice.organization_id
      group by product_id
      order by product_id
    loop
      insert into public.inventory_balances(organization_id,product_id)
      values(v_invoice.organization_id,v_group.product_id)
      on conflict(organization_id,product_id) do nothing;

      select * into v_balance
      from public.inventory_balances
      where organization_id=v_invoice.organization_id and product_id=v_group.product_id
      for update;

      if v_group.qty>v_balance.quantity then
        raise exception 'insufficient stock for product %',v_group.product_id;
      end if;

      v_wac:=v_balance.average_cost;

      select inventory_account_id,cogs_account_id
        into v_inventory_account,v_cogs_account
      from public.products
      where id=v_group.product_id and organization_id=v_invoice.organization_id;

      for v_item in
        select * from public.sales_items
        where sales_invoice_id=v_invoice.id
          and organization_id=v_invoice.organization_id
          and product_id=v_group.product_id
        order by line_number
      loop
        v_cogs:=round(v_wac*v_item.quantity,8);
        update public.sales_items
        set cogs_unit_cost=v_wac,cogs_total=v_cogs
        where id=v_item.id and organization_id=v_invoice.organization_id;
        v_total_cogs:=v_total_cogs+v_cogs;
      end loop;

      v_new_qty:=v_balance.quantity-v_group.qty;
      v_new_value:=round(v_balance.inventory_value-(v_wac*v_group.qty),8);
      if v_new_value<0 then raise exception 'inventory value would become negative'; end if;
      v_new_avg:=case when v_new_qty=0 then 0 else v_new_value/v_new_qty end;

      insert into public.inventory_transactions(
        organization_id,transaction_number,product_id,transaction_date,
        transaction_type,direction,quantity,unit_cost,total_value,
        reference_type,reference_id,unit_cost_before,average_cost_after,created_by
      )
      values(
        v_invoice.organization_id,private.next_number(v_invoice.organization_id,'inventory'),
        v_group.product_id,v_invoice.invoice_date,'sale','out',
        v_group.qty,v_wac,round(v_wac*v_group.qty,8),
        'sales_invoice',v_invoice.id,v_balance.average_cost,v_new_avg,(select auth.uid())
      );

      v_lines:=v_lines||jsonb_build_array(
        jsonb_build_object('account_id',v_cogs_account,'debit',round(v_wac*v_group.qty,8),'credit',0,'description','COGS - '||v_group.product_id),
        jsonb_build_object('account_id',v_inventory_account,'debit',0,'credit',round(v_wac*v_group.qty,8),'description','Inventory relief - '||v_group.product_id)
      );

      update public.inventory_balances
      set quantity=v_new_qty,average_cost=v_new_avg,
          inventory_value=v_new_value,updated_at=now()
      where id=v_balance.id;
    end loop;
  else
    for v_group in
      select product_id,sum(quantity) qty
      from public.sales_items
      where sales_invoice_id=v_invoice.id and organization_id=v_invoice.organization_id
      group by product_id
      order by product_id
    loop
      v_total_cogs:=0;
      insert into public.inventory_balances(organization_id,product_id)
      values(v_invoice.organization_id,v_group.product_id)
      on conflict(organization_id,product_id) do nothing;

      select * into v_balance
      from public.inventory_balances
      where organization_id=v_invoice.organization_id and product_id=v_group.product_id
      for update;

      select inventory_account_id,cogs_account_id,sales_account_id
        into v_inventory_account,v_cogs_account,v_sales_account
      from public.products
      where id=v_group.product_id and organization_id=v_invoice.organization_id;

      v_new_qty:=v_balance.quantity;
      v_new_value:=v_balance.inventory_value;

      for v_item in
        select * from public.sales_items
        where sales_invoice_id=v_invoice.id
          and organization_id=v_invoice.organization_id
          and product_id=v_group.product_id
        order by line_number
      loop
        if v_item.cogs_unit_cost is null then
          raise exception 'sales return requires historical COGS';
        end if;

        v_cogs:=v_item.cogs_total;
        v_total_cogs:=v_total_cogs+v_cogs;
        v_new_qty:=v_new_qty+v_item.quantity;
        v_new_value:=round(v_new_value+v_cogs,8);
        v_new_avg:=case when v_new_qty=0 then 0 else v_new_value/v_new_qty end;

        insert into public.inventory_transactions(
          organization_id,transaction_number,product_id,transaction_date,
          transaction_type,direction,quantity,unit_cost,total_value,
          reference_type,reference_id,unit_cost_before,average_cost_after,created_by
        )
        values(
          v_invoice.organization_id,private.next_number(v_invoice.organization_id,'inventory'),
          v_group.product_id,v_invoice.invoice_date,'sale_return','in',
          v_item.quantity,v_item.cogs_unit_cost,v_cogs,
          'sales_invoice',v_invoice.id,v_balance.average_cost,v_new_avg,(select auth.uid())
        );

        v_balance.average_cost:=v_new_avg;
      end loop;

      v_lines:=v_lines||jsonb_build_array(
        jsonb_build_object('account_id',v_inventory_account,'debit',v_total_cogs,'credit',0,'description','Sales return inventory - '||v_group.product_id),
        jsonb_build_object('account_id',v_cogs_account,'debit',0,'credit',v_total_cogs,'description','Reverse COGS - '||v_group.product_id)
      );

      update public.inventory_balances
      set quantity=v_new_qty,average_cost=v_new_avg,
          inventory_value=v_new_value,updated_at=now()
      where id=v_balance.id;
    end loop;
  end if;

  if v_invoice.document_type='sale' then
    for v_item in
      select si.product_id,si.line_total,p.sales_account_id
      from public.sales_items si
      join public.products p on p.id=si.product_id and p.organization_id=si.organization_id
      where si.sales_invoice_id=v_invoice.id
      order by si.line_number
    loop
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',v_item.sales_account_id,'debit',0,'credit',v_item.line_total,
        'description','Sales revenue - '||v_item.product_id,
        'contact_id',v_invoice.customer_id
      ));
    end loop;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'account_id',p_receivable_account_id,'debit',v_invoice.total_amount,'credit',0,
      'description','Accounts receivable - '||v_invoice.invoice_number,
      'contact_id',v_invoice.customer_id
    ));
    v_journal_id:=private.create_posted_journal(
      v_invoice.organization_id,v_invoice.invoice_date,'sale',
      'sales_invoice',v_invoice.id,'Sales invoice '||v_invoice.invoice_number,v_lines
    );
  else
    for v_item in
      select si.product_id,si.line_total,p.sales_account_id
      from public.sales_items si
      join public.products p on p.id=si.product_id and p.organization_id=si.organization_id
      where si.sales_invoice_id=v_invoice.id
      order by si.line_number
    loop
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',v_item.sales_account_id,'debit',v_item.line_total,
        'credit',0,'description','Sales return revenue reversal - '||v_item.product_id,
        'contact_id',v_invoice.customer_id
      ));
    end loop;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'account_id',p_receivable_account_id,'debit',0,'credit',v_invoice.total_amount,
      'description','Accounts receivable return reversal - '||v_invoice.invoice_number,
      'contact_id',v_invoice.customer_id
    ));
    v_journal_id:=private.create_posted_journal(
      v_invoice.organization_id,v_invoice.invoice_date,'sale_return',
      'sales_invoice',v_invoice.id,'Sales return '||v_invoice.invoice_number,v_lines
    );
  end if;

  update public.sales_invoices
  set receivable_account_id=p_receivable_account_id,
      posted_journal_entry_id=v_journal_id,status='posted'
  where id=v_invoice.id and organization_id=v_invoice.organization_id;

  return v_journal_id;
end;
$$;

-- Expense posting: expense debit against a payable/cash/liability account.
create or replace function public.post_expense(
  p_expense_id uuid,
  p_credit_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_exp public.expenses%rowtype;
  v_expense_account uuid;
  v_journal_id uuid;
  v_lines jsonb;
begin
  select * into v_exp from public.expenses where id=p_expense_id for update;
  if not found then raise exception 'expense not found'; end if;
  if not private.has_org_role(v_exp.organization_id,array['owner','admin','manager','staff']) then raise exception 'not authorized'; end if;
  if v_exp.status<>'draft' then raise exception 'expense is not draft'; end if;
  if v_exp.payable_account_id is null then v_exp.payable_account_id:=p_credit_account_id; end if;
  if v_exp.payable_account_id<>p_credit_account_id then raise exception 'expense settlement account does not match historical mapping'; end if;

  select expense_account_id into v_expense_account
  from public.expense_categories
  where id=v_exp.expense_category_id and organization_id=v_exp.organization_id and is_active;

  if v_expense_account is null then raise exception 'expense category/account is inactive or missing'; end if;
  perform private.require_postable_account(v_exp.organization_id,v_expense_account,'expense');
  perform private.require_postable_account(v_exp.organization_id,p_credit_account_id,'liability');

  v_lines:=jsonb_build_array(
    jsonb_build_object('account_id',v_expense_account,'debit',v_exp.amount,'credit',0,'description',coalesce(v_exp.description,'Expense'),'contact_id',v_exp.contact_id),
    jsonb_build_object('account_id',p_credit_account_id,'debit',0,'credit',v_exp.amount,'description','Expense settlement','contact_id',v_exp.contact_id)
  );

  v_journal_id:=private.create_posted_journal(
    v_exp.organization_id,v_exp.expense_date,'expense',
    'expense',v_exp.id,'Expense '||v_exp.expense_number,v_lines
  );

  update public.expenses
  set payable_account_id=p_credit_account_id,
      posted_journal_entry_id=v_journal_id,status='posted'
  where id=v_exp.id and organization_id=v_exp.organization_id;

  return v_journal_id;
end;
$$;

-- Payment posting is atomic with its allocations. This avoids the classic
-- "payment posted first, allocation added later" race and lets the journal be
-- generated from the exact settlement event.
create or replace function public.post_payment(
  p_payment_id uuid,
  p_settlement_account_id uuid,
  p_allocations jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_payment public.payments%rowtype;
  v_alloc record;
  v_journal_id uuid;
  v_lines jsonb:='[]'::jsonb;
  v_allocated numeric(20,8):=0;
  v_remaining numeric(20,8);
  v_debit numeric(20,8):=0;
  v_credit numeric(20,8):=0;
  v_expected_type text;
  v_cash_side text;
begin
  select * into v_payment from public.payments where id=p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  if not private.has_org_role(v_payment.organization_id,array['owner','admin','manager','staff']) then raise exception 'not authorized'; end if;
  if v_payment.status<>'draft' then raise exception 'payment is not draft'; end if;
  if v_payment.settlement_account_id is null then v_payment.settlement_account_id:=p_settlement_account_id; end if;
  if v_payment.settlement_account_id<>p_settlement_account_id then raise exception 'payment settlement account does not match historical mapping'; end if;
  if jsonb_typeof(p_allocations)<>'array' then raise exception 'allocations must be a JSON array'; end if;

  perform private.require_postable_account(v_payment.organization_id,v_payment.account_id,'asset');

  if v_payment.payment_type in('receipt','refund_out') then
    v_expected_type:='asset';
  else
    v_expected_type:='liability';
  end if;
  perform private.require_postable_account(v_payment.organization_id,p_settlement_account_id,v_expected_type);

  if v_payment.payment_type in('receipt','payment') then
    v_cash_side:=case when v_payment.payment_type='receipt' then 'debit' else 'credit' end;
  else
    v_cash_side:=case when v_payment.payment_type='refund_in' then 'debit' else 'credit' end;
  end if;

  if v_cash_side='debit' then
    v_lines:=jsonb_build_array(jsonb_build_object(
      'account_id',v_payment.account_id,'debit',v_payment.amount,'credit',0,
      'description','Cash/bank receipt '||v_payment.payment_number,'contact_id',v_payment.contact_id
    ));
  else
    v_lines:=jsonb_build_array(jsonb_build_object(
      'account_id',v_payment.account_id,'debit',0,'credit',v_payment.amount,
      'description','Cash/bank payment '||v_payment.payment_number,'contact_id',v_payment.contact_id
    ));
  end if;

  for v_alloc in
    select *
    from jsonb_to_recordset(p_allocations) as x(
      document_type text,
      document_id uuid,
      allocated_amount numeric
    )
  loop
    if v_alloc.allocated_amount is null or v_alloc.allocated_amount<=0 then
      raise exception 'allocation amount must be positive';
    end if;

    if v_payment.payment_type='receipt' and v_alloc.document_type<>'sale' then
      raise exception 'receipt can allocate only to sales invoices';
    elsif v_payment.payment_type='payment' and v_alloc.document_type not in('purchase','expense') then
      raise exception 'payment can allocate only to purchase invoices or expenses';
    elsif v_payment.payment_type='refund_in' and v_alloc.document_type<>'purchase_return' then
      raise exception 'refund_in can allocate only to purchase returns';
    elsif v_payment.payment_type='refund_out' and v_alloc.document_type<>'sale_return' then
      raise exception 'refund_out can allocate only to sales returns';
    end if;

    v_allocated:=v_allocated+v_alloc.allocated_amount;

    if v_payment.payment_type in('receipt','refund_in') then
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',p_settlement_account_id,'debit',0,'credit',v_alloc.allocated_amount,
        'description','Settlement allocation - '||v_alloc.document_type,
        'contact_id',v_payment.contact_id
      ));
    else
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',p_settlement_account_id,'debit',v_alloc.allocated_amount,'credit',0,
        'description','Settlement allocation - '||v_alloc.document_type,
        'contact_id',v_payment.contact_id
      ));
    end if;
  end loop;

  if v_allocated>v_payment.amount then
    raise exception 'payment allocations exceed payment amount';
  end if;

  v_remaining:=round(v_payment.amount-v_allocated,8);
  if v_remaining>0 then
    if v_cash_side='debit' then
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',p_settlement_account_id,'debit',0,'credit',v_remaining,
        'description','Unallocated settlement balance','contact_id',v_payment.contact_id
      ));
    else
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'account_id',p_settlement_account_id,'debit',v_remaining,'credit',0,
        'description','Unallocated settlement balance','contact_id',v_payment.contact_id
      ));
    end if;
  end if;

  v_journal_id:=private.create_posted_journal(
    v_payment.organization_id,v_payment.payment_date,
    case when v_payment.payment_type in('refund_in','refund_out') then 'refund' else 'payment' end,
    'payment',v_payment.id,'Payment '||v_payment.payment_number,v_lines
  );

  update public.payments
  set settlement_account_id=p_settlement_account_id,
      posted_journal_entry_id=v_journal_id,status='posted'
  where id=v_payment.id and organization_id=v_payment.organization_id;

  -- Allocation trigger revalidates document status, compatibility and ceiling.
  for v_alloc in
    select *
    from jsonb_to_recordset(p_allocations) as x(
      document_type text,
      document_id uuid,
      allocated_amount numeric
    )
  loop
    insert into public.payment_allocations(
      organization_id,payment_id,document_type,document_id,allocated_amount
    )
    values(
      v_payment.organization_id,v_payment.id,
      v_alloc.document_type,v_alloc.document_id,v_alloc.allocated_amount
    );
  end loop;

  return v_journal_id;
end;
$$;

-- Manual/opening journal entry. Owner/admin only; still passes the same
-- period, account, balance and immutability gates as operational journals.
create or replace function public.post_manual_journal(
  p_org_id uuid,
  p_entry_date date,
  p_description text,
  p_lines jsonb,
  p_entry_type text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_journal_id uuid;
begin
  if not private.has_org_role(p_org_id,array['owner','admin']) then
    raise exception 'not authorized';
  end if;
  if p_entry_type not in('manual','opening') then
    raise exception 'manual journal entry type is invalid';
  end if;

  v_journal_id:=private.create_posted_journal(
    p_org_id,p_entry_date,p_entry_type,null,null,p_description,p_lines
  );
  return v_journal_id;
end;
$$;

-- Reverse a posted journal into the current open period. The original remains
-- untouched; the reversal is a new immutable posted journal.
create or replace function public.reverse_journal(
  p_journal_id uuid,
  p_reversal_date date,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_original public.journal_entries%rowtype;
  v_new_id uuid;
  v_lines jsonb:='[]'::jsonb;
  v_line record;
  v_period_id uuid;
  v_entry_number text;
begin
  select * into v_original
  from public.journal_entries
  where id=p_journal_id
  for update;

  if not found then raise exception 'journal not found'; end if;
  if not private.has_org_role(v_original.organization_id,array['owner','admin']) then raise exception 'not authorized'; end if;
  if v_original.status<>'posted' then raise exception 'only posted journals can be reversed'; end if;
  if v_original.entry_type not in('manual','opening') then
    raise exception 'operational journals must be corrected by their document workflow, not direct journal reversal';
  end if;
  if exists(select 1 from public.journal_entries where organization_id=v_original.organization_id and reversal_of_id=v_original.id) then
    raise exception 'journal has already been reversed';
  end if;

  v_period_id:=private.open_period_for_date(v_original.organization_id,p_reversal_date);
  v_entry_number:=private.next_number(v_original.organization_id,'journal');

  insert into public.journal_entries(
    organization_id,entry_number,accounting_period_id,entry_date,
    entry_type,status,reference_type,reference_id,description,
    reversal_of_id,created_by
  )
  values(
    v_original.organization_id,v_entry_number,v_period_id,p_reversal_date,
    'reversal','draft','journal_entry',v_original.id,
    coalesce(p_description,'Reversal of '||v_original.entry_number),
    v_original.id,(select auth.uid())
  )
  returning id into v_new_id;

  for v_line in
    select * from public.account_transactions
    where organization_id=v_original.organization_id
      and journal_entry_id=v_original.id
    order by line_number
  loop
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'account_id',v_line.account_id,
      'debit',v_line.credit,
      'credit',v_line.debit,
      'description','Reversal of line '||v_line.line_number,
      'contact_id',v_line.contact_id
    ));
  end loop;

  -- Reuse the already-created header rather than creating a second header.
  for v_line in
    select *
    from jsonb_to_recordset(v_lines) as x(
      account_id uuid,debit numeric,credit numeric,description text,contact_id uuid
    )
  loop
    insert into public.account_transactions(
      organization_id,journal_entry_id,account_id,line_number,
      description,debit,credit,contact_id
    )
    values(
      v_original.organization_id,v_new_id,
      v_line.account_id,
      (select coalesce(max(line_number),0)+1 from public.account_transactions where journal_entry_id=v_new_id),
      v_line.description,v_line.debit,v_line.credit,v_line.contact_id
    );
  end loop;

  update public.journal_entries set status='posted' where id=v_new_id;
  return v_new_id;
end;
$$;

-- Strengthen payment allocations with payment-type compatibility and a
-- document-level ceiling, not merely a payment-level ceiling.
create or replace function private.validate_payment_allocation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  pa numeric(30,8);
  ps text;
  pt text;
  allocated numeric(30,8);
  doc_allocated numeric(30,8);
  doc_total numeric(30,8);
  ok boolean:=false;
begin
  select amount,status,payment_type into pa,ps,pt
  from public.payments
  where id=new.payment_id and organization_id=new.organization_id
  for update;

  if ps is null then raise exception 'payment not found'; end if;
  if ps<>'posted' then raise exception 'payment must be posted before allocation'; end if;

  if pt='receipt' and new.document_type<>'sale' then raise exception 'receipt allocation type mismatch'; end if;
  if pt='payment' and new.document_type not in('purchase','expense') then raise exception 'payment allocation type mismatch'; end if;
  if pt='refund_in' and new.document_type<>'purchase_return' then raise exception 'refund_in allocation type mismatch'; end if;
  if pt='refund_out' and new.document_type<>'sale_return' then raise exception 'refund_out allocation type mismatch'; end if;

  if new.document_type in('purchase','purchase_return','expense') then
    if new.document_type='expense' then
      select exists(select 1 from public.expenses where id=new.document_id and organization_id=new.organization_id and status='posted'),
             coalesce((select amount from public.expenses where id=new.document_id and organization_id=new.organization_id),0)
        into ok,doc_total;
    else
      select exists(select 1 from public.purchase_invoices where id=new.document_id and organization_id=new.organization_id and status='posted'),
             coalesce((select total_amount from public.purchase_invoices where id=new.document_id and organization_id=new.organization_id),0)
        into ok,doc_total;
    end if;
  else
    select exists(select 1 from public.sales_invoices where id=new.document_id and organization_id=new.organization_id and status='posted'),
           coalesce((select total_amount from public.sales_invoices where id=new.document_id and organization_id=new.organization_id),0)
      into ok,doc_total;
  end if;

  if not ok then raise exception 'allocation target must be posted'; end if;

  if pt in('receipt','refund_out') and new.document_type in('sale','sale_return') then
    if (select customer_id from public.sales_invoices where id=new.document_id and organization_id=new.organization_id) is distinct from (select contact_id from public.payments where id=new.payment_id and organization_id=new.organization_id) then
      raise exception 'payment contact does not match sales customer';
    end if;
  elsif pt in('payment','refund_in') and new.document_type in('purchase','purchase_return') then
    if (select supplier_id from public.purchase_invoices where id=new.document_id and organization_id=new.organization_id) is distinct from (select contact_id from public.payments where id=new.payment_id and organization_id=new.organization_id) then
      raise exception 'payment contact does not match purchase supplier';
    end if;
  end if;

  select coalesce(sum(allocated_amount),0)
    into allocated
  from public.payment_allocations
  where organization_id=new.organization_id
    and payment_id=new.payment_id
    and id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);

  if allocated+new.allocated_amount>pa then
    raise exception 'payment allocations exceed payment amount';
  end if;

  select coalesce(sum(allocated_amount),0)
    into doc_allocated
  from public.payment_allocations
  where organization_id=new.organization_id
    and document_type=new.document_type
    and document_id=new.document_id
    and id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);

  if doc_allocated+new.allocated_amount>doc_total then
    raise exception 'document allocations exceed document amount';
  end if;

  return new;
end;
$$;

-- Private posting helpers are never part of the client API surface.
revoke all on function private.next_number(uuid,text) from public,authenticated;
revoke all on function private.require_postable_account(uuid,uuid,text) from public,authenticated;
revoke all on function private.open_period_for_date(uuid,date) from public,authenticated;
revoke all on function private.create_posted_journal(uuid,date,text,text,uuid,text,jsonb,uuid) from public,authenticated;
revoke all on function private.guard_posted_document() from public,authenticated;
revoke all on function private.validate_payment_allocation() from public,authenticated;
revoke all on function private.validate_purchase_post() from public,authenticated;
revoke all on function private.validate_sale_post() from public,authenticated;
revoke all on function private.validate_journal_post() from public,authenticated;

-- Posted payment allocations are settlement history and are immutable. A
-- correction is performed by reversing/replacing the payment event, not by
-- editing historical allocation rows.
create or replace function private.guard_payment_allocation_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'payment allocations are immutable';
end;
$$;
create trigger payment_allocations_validation_trg
before insert or update on public.payment_allocations
for each row execute function private.validate_payment_allocation();

revoke all on function private.guard_payment_allocation_mutation() from public,authenticated;
create trigger payment_allocations_immutable_trg
before update or delete on public.payment_allocations
for each row execute function private.guard_payment_allocation_mutation();

-- Public RPC execution boundary.
revoke all on function public.post_purchase_invoice(uuid,uuid) from public;
revoke all on function public.post_sales_invoice(uuid,uuid) from public;
revoke all on function public.post_expense(uuid,uuid) from public;
revoke all on function public.post_payment(uuid,uuid,jsonb) from public;
revoke all on function public.post_manual_journal(uuid,date,text,jsonb,text) from public;
revoke all on function public.reverse_journal(uuid,date,text) from public;

grant execute on function public.post_purchase_invoice(uuid,uuid) to authenticated;
grant execute on function public.post_sales_invoice(uuid,uuid) to authenticated;
grant execute on function public.post_expense(uuid,uuid) to authenticated;
grant execute on function public.post_payment(uuid,uuid,jsonb) to authenticated;
grant execute on function public.post_manual_journal(uuid,date,text,jsonb,text) to authenticated;
grant execute on function public.reverse_journal(uuid,date,text) to authenticated;

-- Anonymous clients must never reach privileged accounting/inventory posting RPCs.
-- Signed-in users remain the intended API caller; the functions retain their
-- SECURITY DEFINER boundary and perform their own organization/role checks.
revoke execute on function public.post_purchase_invoice(uuid,uuid) from anon;
revoke execute on function public.post_sales_invoice(uuid,uuid) from anon;
revoke execute on function public.post_expense(uuid,uuid) from anon;
revoke execute on function public.post_payment(uuid,uuid,jsonb) from anon;
revoke execute on function public.post_manual_journal(uuid,date,text,jsonb,text) from anon;
revoke execute on function public.reverse_journal(uuid,date,text) from anon;

-- RLS boundary for all 21 public tables.
do $$ declare t text; begin foreach t in array array['profiles','organizations','organization_users','units_of_measure','products','contacts','number_sequences','accounts','journal_entries','account_transactions','accounting_periods','purchase_invoices','purchase_items','sales_invoices','sales_items','inventory_balances','inventory_transactions','expense_categories','expenses','payments','payment_allocations'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on table public.%I from anon,authenticated',t); execute format('grant select on table public.%I to authenticated',t); end loop; end $$;

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
do $$
declare
  t text;
  v_roles text[] := array['owner','admin','manager','staff'];
  v_tables text[] := array['purchase_invoices','purchase_items','sales_invoices','sales_items','expenses','payments','payment_allocations'];
begin
  foreach t in array v_tables loop
    execute format(
      'create policy %I_write on public.%I for all to authenticated using ((select private.has_org_role(organization_id,%L::text[]))) with check ((select private.has_org_role(organization_id,%L::text[])))',
      t,t,v_roles,v_roles
    );
  end loop;
end $$;

grant select,insert,update on public.profiles to authenticated;
grant select,insert,update on public.organizations to authenticated;
grant select,insert,update,delete on public.organization_users to authenticated;
grant select,insert,update,delete on public.units_of_measure to authenticated;
grant select,insert,update on public.products,public.contacts to authenticated;
grant select on public.number_sequences to authenticated;
grant select,insert,update on public.accounts,public.accounting_periods to authenticated;
grant select on public.journal_entries,public.account_transactions,public.inventory_balances,public.inventory_transactions to authenticated;
grant select,insert,update,delete on public.purchase_invoices,public.purchase_items,public.sales_invoices,public.sales_items,public.expenses,public.payments,public.payment_allocations to authenticated;
