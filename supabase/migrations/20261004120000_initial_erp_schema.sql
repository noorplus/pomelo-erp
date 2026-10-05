-- Pomelo ERP — initial schema
-- 24 public tables
-- REVIEW / NOT APPLIED
-- Generated for local review only. Do not run against the target database until explicitly approved.

begin;

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Shared types
-- -----------------------------------------------------------------------------
create type public.document_status as enum ('DRAFT', 'CONFIRMED', 'CANCELLED');
create type public.accounting_period_status as enum ('OPEN', 'CLOSED');
create type public.journal_entry_type as enum (
  'PURCHASE', 'SALES', 'PURCHASE_RETURN', 'SALES_RETURN',
  'EXPENSE', 'PAYMENT', 'OPENING', 'ADJUSTMENT', 'OTHER'
);
create type public.payment_type as enum ('RECEIPT', 'PAYMENT');

-- -----------------------------------------------------------------------------
-- Common trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. organizations
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  city text,
  country text,
  base_currency char(3) not null default 'BDT',
  timezone text not null default 'Asia/Dhaka',
  tin text,
  bin text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_chk check (length(btrim(name)) > 0),
  constraint organizations_currency_chk check (base_currency ~ '^[A-Z]{3}$')
);

-- -----------------------------------------------------------------------------
-- 2. organization_users
-- -----------------------------------------------------------------------------
create table public.organization_users (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_users_org_user_uq unique (organization_id, user_id),
  constraint organization_users_org_id_uq unique (organization_id, id)
);

-- -----------------------------------------------------------------------------
-- 3. units_of_measure
-- -----------------------------------------------------------------------------
create table public.units_of_measure (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint units_org_id_uq unique (organization_id, id),
  constraint units_name_uq unique (organization_id, name),
  constraint units_name_chk check (length(btrim(name)) > 0)
);

-- -----------------------------------------------------------------------------
-- 4. accounting_periods
-- -----------------------------------------------------------------------------
create table public.accounting_periods (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status public.accounting_period_status not null default 'OPEN',
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_periods_org_id_uq unique (organization_id, id),
  constraint accounting_periods_name_uq unique (organization_id, name),
  constraint accounting_periods_dates_chk check (start_date <= end_date),
  constraint accounting_periods_closed_chk check (
    (status = 'OPEN' and closed_at is null)
    or
    (status = 'CLOSED' and closed_at is not null)
  ),
  constraint accounting_periods_no_overlap
    exclude using gist (
      organization_id with =,
      daterange(start_date, end_date, '[]') with &&
    )
);

-- -----------------------------------------------------------------------------
-- 5. accounts
-- -----------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_code text not null,
  account_name text not null,
  account_type text not null,
  parent_account_id uuid,
  normal_balance text not null,
  is_control_account boolean not null default false,
  is_system_account boolean not null default false,
  is_postable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_org_id_uq unique (organization_id, id),
  constraint accounts_code_uq unique (organization_id, account_code),
  constraint accounts_parent_fk
    foreign key (organization_id, parent_account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint accounts_type_chk check (account_type in ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  constraint accounts_balance_chk check (normal_balance in ('DEBIT','CREDIT')),
  constraint accounts_name_chk check (length(btrim(account_name)) > 0),
  constraint accounts_parent_self_chk check (parent_account_id is null or parent_account_id <> id)
);

-- -----------------------------------------------------------------------------
-- 6. products
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_code text,
  name text not null,
  unit_id uuid not null,
  inventory_account_id uuid not null,
  sales_account_id uuid not null,
  cogs_account_id uuid not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_org_id_uq unique (organization_id, id),
  constraint products_code_uq unique (organization_id, product_code),
  constraint products_unit_fk
    foreign key (organization_id, unit_id)
    references public.units_of_measure(organization_id, id)
    on delete restrict,
  constraint products_inventory_account_fk
    foreign key (organization_id, inventory_account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint products_sales_account_fk
    foreign key (organization_id, sales_account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint products_cogs_account_fk
    foreign key (organization_id, cogs_account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint products_name_chk check (length(btrim(name)) > 0)
);

-- -----------------------------------------------------------------------------
-- 7. contacts
-- -----------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_number text,
  name text not null,
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_org_id_uq unique (organization_id, id),
  constraint contacts_number_uq unique (organization_id, contact_number),
  constraint contacts_name_chk check (length(btrim(name)) > 0)
);

-- -----------------------------------------------------------------------------
-- 8. number_sequences
-- -----------------------------------------------------------------------------
create table public.number_sequences (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null,
  prefix text not null,
  next_number bigint not null default 1,
  padding smallint not null default 6,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint number_sequences_org_id_uq unique (organization_id, id),
  constraint number_sequences_type_uq unique (organization_id, document_type),
  constraint number_sequences_next_chk check (next_number >= 1),
  constraint number_sequences_padding_chk check (padding between 1 and 12),
  constraint number_sequences_prefix_chk check (length(prefix) > 0)
);

-- -----------------------------------------------------------------------------
-- 9. journal_entries
-- -----------------------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entry_number text,
  accounting_period_id uuid not null,
  entry_date date not null,
  entry_type public.journal_entry_type not null,
  status public.document_status not null default 'DRAFT',
  reference_type text,
  reference_id uuid,
  description text,
  posted_at timestamptz,
  reversal_of_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entries_org_id_uq unique (organization_id, id),
  constraint journal_entries_number_uq unique (organization_id, entry_number),
  constraint journal_entries_period_fk
    foreign key (organization_id, accounting_period_id)
    references public.accounting_periods(organization_id, id)
    on delete restrict,
  constraint journal_entries_reversal_fk
    foreign key (organization_id, reversal_of_id)
    references public.journal_entries(organization_id, id)
    on delete restrict,
  constraint journal_entries_status_number_chk check (
    (status = 'DRAFT' and entry_number is null)
    or
    (status in ('CONFIRMED','CANCELLED') and entry_number is not null)
  ),
  constraint journal_entries_posted_chk check (
    (status = 'DRAFT' and posted_at is null)
    or
    (status in ('CONFIRMED','CANCELLED') and posted_at is not null)
  ),
  constraint journal_entries_reversal_self_chk check (reversal_of_id is null or reversal_of_id <> id)
);

-- -----------------------------------------------------------------------------
-- 10. account_transactions
-- -----------------------------------------------------------------------------
create table public.account_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  journal_entry_id uuid not null,
  account_id uuid not null,
  line_number integer not null,
  description text,
  debit numeric(20,4) not null default 0,
  credit numeric(20,4) not null default 0,
  contact_id uuid,
  created_at timestamptz not null default now(),
  constraint account_transactions_org_id_uq unique (organization_id, id),
  constraint account_transactions_journal_fk
    foreign key (organization_id, journal_entry_id)
    references public.journal_entries(organization_id, id)
    on delete restrict,
  constraint account_transactions_account_fk
    foreign key (organization_id, account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint account_transactions_contact_fk
    foreign key (organization_id, contact_id)
    references public.contacts(organization_id, id)
    on delete restrict,
  constraint account_transactions_line_uq unique (journal_entry_id, line_number),
  constraint account_transactions_line_chk check (line_number > 0),
  constraint account_transactions_amount_chk check (
    debit >= 0 and credit >= 0 and
    ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
  )
);

-- -----------------------------------------------------------------------------
-- 11. purchase
-- -----------------------------------------------------------------------------
create table public.purchase (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id text,
  supplier_id uuid not null,
  invoice_date date not null,
  status public.document_status not null default 'DRAFT',
  subtotal numeric(20,4) not null default 0,
  discount_amount numeric(20,4) not null default 0,
  total_amount numeric(20,4) not null default 0,
  payable_account_id uuid not null,
  posted_journal_entry_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_org_id_uq unique (organization_id, id),
  constraint purchase_invoice_uq unique (organization_id, invoice_id),
  constraint purchase_supplier_fk
    foreign key (organization_id, supplier_id)
    references public.contacts(organization_id, id)
    on delete restrict,
  constraint purchase_payable_account_fk
    foreign key (organization_id, payable_account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint purchase_journal_fk
    foreign key (organization_id, posted_journal_entry_id)
    references public.journal_entries(organization_id, id)
    on delete restrict,
  constraint purchase_amount_chk check (
    subtotal >= 0 and discount_amount >= 0 and discount_amount <= subtotal and
    total_amount = subtotal - discount_amount
  ),
  constraint purchase_status_number_chk check (
    (status = 'DRAFT' and invoice_id is null and posted_journal_entry_id is null)
    or
    (status in ('CONFIRMED','CANCELLED') and invoice_id is not null and posted_journal_entry_id is not null)
  )
);

-- -----------------------------------------------------------------------------
-- 12. purchase_items
-- -----------------------------------------------------------------------------
create table public.purchase_items (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_id uuid not null,
  line_number integer not null,
  product_id uuid not null,
  quantity numeric(20,4) not null,
  unit_cost numeric(20,4) not null,
  line_total numeric(20,4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_items_org_id_uq unique (organization_id, id),
  constraint purchase_items_purchase_fk
    foreign key (organization_id, purchase_id)
    references public.purchase(organization_id, id)
    on delete cascade,
  constraint purchase_items_product_fk
    foreign key (organization_id, product_id)
    references public.products(organization_id, id)
    on delete restrict,
  constraint purchase_items_line_uq unique (purchase_id, line_number),
  constraint purchase_items_line_chk check (line_number > 0),
  constraint purchase_items_amount_chk check (
    quantity > 0 and unit_cost >= 0 and line_total = quantity * unit_cost
  )
);

-- -----------------------------------------------------------------------------
-- 13. sales
-- -----------------------------------------------------------------------------
create table public.sales (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id text,
  customer_id uuid not null,
  invoice_date date not null,
  status public.document_status not null default 'DRAFT',
  subtotal numeric(20,4) not null default 0,
  discount_amount numeric(20,4) not null default 0,
  total_amount numeric(20,4) not null default 0,
  receivable_account_id uuid not null,
  posted_journal_entry_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_org_id_uq unique (organization_id, id),
  constraint sales_invoice_uq unique (organization_id, invoice_id),
  constraint sales_customer_fk
    foreign key (organization_id, customer_id)
    references public.contacts(organization_id, id)
    on delete restrict,
  constraint sales_receivable_account_fk
    foreign key (organization_id, receivable_account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint sales_journal_fk
    foreign key (organization_id, posted_journal_entry_id)
    references public.journal_entries(organization_id, id)
    on delete restrict,
  constraint sales_amount_chk check (
    subtotal >= 0 and discount_amount >= 0 and discount_amount <= subtotal and
    total_amount = subtotal - discount_amount
  ),
  constraint sales_status_number_chk check (
    (status = 'DRAFT' and invoice_id is null and posted_journal_entry_id is null)
    or
    (status in ('CONFIRMED','CANCELLED') and invoice_id is not null and posted_journal_entry_id is not null)
  )
);

-- -----------------------------------------------------------------------------
-- 14. sales_items
-- -----------------------------------------------------------------------------
create table public.sales_items (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_id uuid not null,
  line_number integer not null,
  product_id uuid not null,
  quantity numeric(20,4) not null,
  unit_price numeric(20,4) not null,
  line_total numeric(20,4) not null,
  cogs_unit_cost numeric(20,4) not null default 0,
  cogs_total numeric(20,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_items_org_id_uq unique (organization_id, id),
  constraint sales_items_sales_fk
    foreign key (organization_id, sales_id)
    references public.sales(organization_id, id)
    on delete cascade,
  constraint sales_items_product_fk
    foreign key (organization_id, product_id)
    references public.products(organization_id, id)
    on delete restrict,
  constraint sales_items_line_uq unique (sales_id, line_number),
  constraint sales_items_line_chk check (line_number > 0),
  constraint sales_items_amount_chk check (
    quantity > 0 and unit_price >= 0 and line_total = quantity * unit_price and
    cogs_unit_cost >= 0 and cogs_total = quantity * cogs_unit_cost
  )
);

-- -----------------------------------------------------------------------------
-- 15. inventory_balances
-- -----------------------------------------------------------------------------
create table public.inventory_balances (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  quantity numeric(20,4) not null default 0,
  average_cost numeric(20,4) not null default 0,
  inventory_value numeric(20,4) not null default 0,
  updated_at timestamptz not null default now(),
  constraint inventory_balances_org_id_uq unique (organization_id, id),
  constraint inventory_balances_product_uq unique (organization_id, product_id),
  constraint inventory_balances_product_fk
    foreign key (organization_id, product_id)
    references public.products(organization_id, id)
    on delete restrict,
  constraint inventory_balances_amount_chk check (
    quantity >= 0 and average_cost >= 0 and inventory_value >= 0
  )
);

-- -----------------------------------------------------------------------------
-- 16. inventory_transactions
-- -----------------------------------------------------------------------------
create table public.inventory_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_number text not null,
  product_id uuid not null,
  transaction_date date not null,
  transaction_type text not null,
  direction text not null,
  quantity numeric(20,4) not null,
  unit_cost numeric(20,4) not null,
  total_value numeric(20,4) not null,
  reference_type text,
  reference_id uuid,
  unit_cost_before numeric(20,4),
  average_cost_after numeric(20,4) not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_transactions_org_id_uq unique (organization_id, id),
  constraint inventory_transactions_number_uq unique (organization_id, transaction_number),
  constraint inventory_transactions_product_fk
    foreign key (organization_id, product_id)
    references public.products(organization_id, id)
    on delete restrict,
  constraint inventory_transactions_direction_chk check (direction in ('IN','OUT')),
  constraint inventory_transactions_quantity_chk check (quantity > 0),
  constraint inventory_transactions_cost_chk check (
    unit_cost >= 0 and total_value = quantity * unit_cost and
    (unit_cost_before is null or unit_cost_before >= 0) and average_cost_after >= 0
  )
);

-- -----------------------------------------------------------------------------
-- 17. expense_categories
-- -----------------------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_code text not null,
  name text not null,
  expense_account_id uuid not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_categories_org_id_uq unique (organization_id, id),
  constraint expense_categories_code_uq unique (organization_id, category_code),
  constraint expense_categories_account_fk
    foreign key (organization_id, expense_account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint expense_categories_name_chk check (length(btrim(name)) > 0)
);

-- -----------------------------------------------------------------------------
-- 18. expenses
-- -----------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expense_number text,
  expense_category_id uuid not null,
  contact_id uuid,
  payable_account_id uuid not null,
  expense_date date not null,
  amount numeric(20,4) not null,
  description text,
  status public.document_status not null default 'DRAFT',
  posted_journal_entry_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_org_id_uq unique (organization_id, id),
  constraint expenses_number_uq unique (organization_id, expense_number),
  constraint expenses_category_fk
    foreign key (organization_id, expense_category_id)
    references public.expense_categories(organization_id, id)
    on delete restrict,
  constraint expenses_contact_fk
    foreign key (organization_id, contact_id)
    references public.contacts(organization_id, id)
    on delete restrict,
  constraint expenses_payable_account_fk
    foreign key (organization_id, payable_account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint expenses_journal_fk
    foreign key (organization_id, posted_journal_entry_id)
    references public.journal_entries(organization_id, id)
    on delete restrict,
  constraint expenses_amount_chk check (amount > 0),
  constraint expenses_status_number_chk check (
    (status = 'DRAFT' and expense_number is null and posted_journal_entry_id is null)
    or
    (status in ('CONFIRMED','CANCELLED') and expense_number is not null and posted_journal_entry_id is not null)
  )
);

-- -----------------------------------------------------------------------------
-- 19. payments
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_number text,
  payment_type public.payment_type not null,
  contact_id uuid,
  payment_date date not null,
  amount numeric(20,4) not null,
  account_id uuid not null,
  settlement_account_id uuid not null,
  status public.document_status not null default 'DRAFT',
  posted_journal_entry_id uuid,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_org_id_uq unique (organization_id, id),
  constraint payments_number_uq unique (organization_id, payment_number),
  constraint payments_contact_fk
    foreign key (organization_id, contact_id)
    references public.contacts(organization_id, id)
    on delete restrict,
  constraint payments_account_fk
    foreign key (organization_id, account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint payments_settlement_account_fk
    foreign key (organization_id, settlement_account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint payments_journal_fk
    foreign key (organization_id, posted_journal_entry_id)
    references public.journal_entries(organization_id, id)
    on delete restrict,
  constraint payments_amount_chk check (amount > 0),
  constraint payments_status_number_chk check (
    (status = 'DRAFT' and payment_number is null and posted_journal_entry_id is null)
    or
    (status in ('CONFIRMED','CANCELLED') and payment_number is not null and posted_journal_entry_id is not null)
  )
);

-- -----------------------------------------------------------------------------
-- 20. payment_allocations
-- -----------------------------------------------------------------------------
create table public.payment_allocations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid not null,
  document_type text not null,
  document_id uuid not null,
  allocated_amount numeric(20,4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_allocations_org_id_uq unique (organization_id, id),
  constraint payment_allocations_payment_fk
    foreign key (organization_id, payment_id)
    references public.payments(organization_id, id)
    on delete cascade,
  constraint payment_allocations_type_chk check (document_type in ('PURCHASE','SALES','EXPENSE')),
  constraint payment_allocations_amount_chk check (allocated_amount > 0)
);

-- -----------------------------------------------------------------------------
-- 21. purchase_returns
-- -----------------------------------------------------------------------------
create table public.purchase_returns (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  return_number text,
  purchase_id uuid not null,
  supplier_id uuid not null,
  return_date date not null,
  status public.document_status not null default 'DRAFT',
  subtotal numeric(20,4) not null default 0,
  discount_amount numeric(20,4) not null default 0,
  total_amount numeric(20,4) not null default 0,
  payable_account_id uuid not null,
  posted_journal_entry_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_returns_org_id_uq unique (organization_id, id),
  constraint purchase_returns_number_uq unique (organization_id, return_number),
  constraint purchase_returns_purchase_fk
    foreign key (organization_id, purchase_id)
    references public.purchase(organization_id, id)
    on delete restrict,
  constraint purchase_returns_supplier_fk
    foreign key (organization_id, supplier_id)
    references public.contacts(organization_id, id)
    on delete restrict,
  constraint purchase_returns_payable_account_fk
    foreign key (organization_id, payable_account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint purchase_returns_journal_fk
    foreign key (organization_id, posted_journal_entry_id)
    references public.journal_entries(organization_id, id)
    on delete restrict,
  constraint purchase_returns_amount_chk check (
    subtotal >= 0 and discount_amount >= 0 and discount_amount <= subtotal and
    total_amount = subtotal - discount_amount
  ),
  constraint purchase_returns_status_number_chk check (
    (status = 'DRAFT' and return_number is null and posted_journal_entry_id is null)
    or
    (status in ('CONFIRMED','CANCELLED') and return_number is not null and posted_journal_entry_id is not null)
  )
);

-- -----------------------------------------------------------------------------
-- 22. purchase_return_items
-- -----------------------------------------------------------------------------
create table public.purchase_return_items (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_return_id uuid not null,
  line_number integer not null,
  purchase_item_id uuid not null,
  product_id uuid not null,
  quantity numeric(20,4) not null,
  unit_cost numeric(20,4) not null,
  line_total numeric(20,4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),  constraint purchase_return_items_org_id_uq unique (organization_id, id),
  constraint purchase_return_items_return_fk
    foreign key (organization_id, purchase_return_id)
    references public.purchase_returns(organization_id, id)
    on delete cascade,
  constraint purchase_return_items_purchase_item_fk
    foreign key (organization_id, purchase_item_id)
    references public.purchase_items(organization_id, id)
    on delete restrict,
  constraint purchase_return_items_product_fk
    foreign key (organization_id, product_id)
    references public.products(organization_id, id)
    on delete restrict,
  constraint purchase_return_items_line_uq unique (purchase_return_id, line_number),
  constraint purchase_return_items_line_chk check (line_number > 0),
  constraint purchase_return_items_amount_chk check (
    quantity > 0 and unit_cost >= 0 and line_total = quantity * unit_cost
  )
);

-- -----------------------------------------------------------------------------
-- 23. sales_returns
-- -----------------------------------------------------------------------------
create table public.sales_returns (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  return_number text,
  sales_id uuid not null,
  customer_id uuid not null,
  return_date date not null,
  status public.document_status not null default 'DRAFT',
  subtotal numeric(20,4) not null default 0,
  discount_amount numeric(20,4) not null default 0,
  total_amount numeric(20,4) not null default 0,
  receivable_account_id uuid not null,
  posted_journal_entry_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_returns_org_id_uq unique (organization_id, id),
  constraint sales_returns_number_uq unique (organization_id, return_number),
  constraint sales_returns_sales_fk
    foreign key (organization_id, sales_id)
    references public.sales(organization_id, id)
    on delete restrict,
  constraint sales_returns_customer_fk
    foreign key (organization_id, customer_id)
    references public.contacts(organization_id, id)
    on delete restrict,
  constraint sales_returns_receivable_account_fk
    foreign key (organization_id, receivable_account_id)
    references public.accounts(organization_id, id)
    on delete restrict,
  constraint sales_returns_journal_fk
    foreign key (organization_id, posted_journal_entry_id)
    references public.journal_entries(organization_id, id)
    on delete restrict,
  constraint sales_returns_amount_chk check (
    subtotal >= 0 and discount_amount >= 0 and discount_amount <= subtotal and
    total_amount = subtotal - discount_amount
  ),
  constraint sales_returns_status_number_chk check (
    (status = 'DRAFT' and return_number is null and posted_journal_entry_id is null)
    or
    (status in ('CONFIRMED','CANCELLED') and return_number is not null and posted_journal_entry_id is not null)
  )
);

-- -----------------------------------------------------------------------------
-- 24. sales_return_items
-- -----------------------------------------------------------------------------
create table public.sales_return_items (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_return_id uuid not null,
  line_number integer not null,
  sales_item_id uuid not null,
  product_id uuid not null,
  quantity numeric(20,4) not null,
  unit_price numeric(20,4) not null,
  line_total numeric(20,4) not null,
  cogs_unit_cost numeric(20,4) not null default 0,
  cogs_total numeric(20,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_return_items_org_id_uq unique (organization_id, id),
  constraint sales_return_items_return_fk
    foreign key (organization_id, sales_return_id)
    references public.sales_returns(organization_id, id)
    on delete cascade,
  constraint sales_return_items_sales_item_fk
    foreign key (organization_id, sales_item_id)
    references public.sales_items(organization_id, id)
    on delete restrict,
  constraint sales_return_items_product_fk
    foreign key (organization_id, product_id)
    references public.products(organization_id, id)
    on delete restrict,
  constraint sales_return_items_line_uq unique (sales_return_id, line_number),
  constraint sales_return_items_line_chk check (line_number > 0),
  constraint sales_return_items_amount_chk check (
    quantity > 0 and unit_price >= 0 and line_total = quantity * unit_price and
    cogs_unit_cost >= 0 and cogs_total = quantity * cogs_unit_cost
  )
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index organization_users_user_idx on public.organization_users(user_id) where is_active;
create index units_of_measure_org_active_idx on public.units_of_measure(organization_id, is_active);
create index accounting_periods_org_dates_idx on public.accounting_periods(organization_id, start_date, end_date);
create index accounts_org_parent_idx on public.accounts(organization_id, parent_account_id);
create index accounts_org_active_idx on public.accounts(organization_id, is_active);
create index products_org_active_idx on public.products(organization_id, is_active);
create index contacts_org_active_idx on public.contacts(organization_id, is_active);
create index number_sequences_org_active_idx on public.number_sequences(organization_id, is_active);
create index journal_entries_org_date_idx on public.journal_entries(organization_id, entry_date);
create index journal_entries_period_idx on public.journal_entries(organization_id, accounting_period_id, entry_date);
create index journal_entries_org_status_idx on public.journal_entries(organization_id, status);
create index account_transactions_journal_idx on public.account_transactions(journal_entry_id, line_number);
create index account_transactions_account_idx on public.account_transactions(organization_id, account_id);
create index purchase_org_date_idx on public.purchase(organization_id, invoice_date desc);
create index purchase_org_status_idx on public.purchase(organization_id, status);
create index purchase_items_purchase_idx on public.purchase_items(purchase_id, line_number);
create index sales_org_date_idx on public.sales(organization_id, invoice_date desc);
create index sales_org_status_idx on public.sales(organization_id, status);
create index sales_items_sales_idx on public.sales_items(sales_id, line_number);
create index inventory_transactions_product_date_idx on public.inventory_transactions(organization_id, product_id, transaction_date, created_at);
create index expense_categories_org_active_idx on public.expense_categories(organization_id, is_active);
create index expenses_org_date_idx on public.expenses(organization_id, expense_date desc);
create index expenses_org_status_idx on public.expenses(organization_id, status);
create index payments_org_date_idx on public.payments(organization_id, payment_date desc);
create index payments_org_status_idx on public.payments(organization_id, status);
create index payment_allocations_payment_idx on public.payment_allocations(payment_id);
create index payment_allocations_document_idx on public.payment_allocations(organization_id, document_type, document_id);
create index purchase_returns_org_date_idx on public.purchase_returns(organization_id, return_date desc);
create index sales_returns_org_date_idx on public.sales_returns(organization_id, return_date desc);

-- -----------------------------------------------------------------------------
-- updated_at triggers — mutable/master/document tables only
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations','organization_users','units_of_measure','accounting_periods',
    'accounts','products','contacts','number_sequences','journal_entries',
    'purchase','purchase_items','sales','sales_items','expense_categories','expenses',
    'payments','payment_allocations','purchase_returns','purchase_return_items',
    'sales_returns','sales_return_items'
  ] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Sequence allocator
-- Drafts never call this. Confirmation RPCs will call it transactionally.
-- -----------------------------------------------------------------------------
create or replace function public.allocate_number(p_organization_id uuid, p_document_type text)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $orig$
declare
  v_prefix text;
  v_next bigint;
  v_padding smallint;
  v_result text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1
    from public.organization_users ou
    where ou.organization_id = p_organization_id
      and ou.user_id = auth.uid()
      and ou.is_active
  ) then
    raise exception 'not an active organization member';
  end if;

  select ns.prefix, ns.next_number, ns.padding
    into v_prefix, v_next, v_padding
  from public.number_sequences ns
  where ns.organization_id = p_organization_id
    and ns.document_type = p_document_type
    and ns.is_active
  for update;

  if not found then
    raise exception 'active number sequence not found for %', p_document_type;
  end if;

  update public.number_sequences
  set next_number = v_next + 1,
      updated_at = now()
  where organization_id = p_organization_id
    and document_type = p_document_type;

  v_result := v_prefix || lpad(v_next::text, v_padding, '0');
  return v_result;
end;
$$;

-- Direct number allocation is intentionally not granted to anonymous users.
revoke all on function public.allocate_number(uuid, text) from public;
grant execute on function public.allocate_number(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Journal validation helper
-- -----------------------------------------------------------------------------
create or replace function public.validate_journal_balance(p_journal_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $orig$
declare
  v_org uuid;
  v_lines integer;
  v_debit numeric(30,4);
  v_credit numeric(30,4);
begin
  select organization_id into v_org
  from public.journal_entries
  where id = p_journal_entry_id;

  if v_org is null then
    raise exception 'journal entry not found';
  end if;

  if not exists (
    select 1 from public.organization_users
    where organization_id = v_org and user_id = auth.uid() and is_active
  ) then
    raise exception 'not an active organization member';
  end if;

  select count(*), coalesce(sum(debit),0), coalesce(sum(credit),0)
    into v_lines, v_debit, v_credit
  from public.account_transactions
  where journal_entry_id = p_journal_entry_id;

  if v_lines < 2 then
    raise exception 'journal entry must contain at least two lines';
  end if;

  if v_debit <> v_credit then
    raise exception 'journal entry is not balanced: debit %, credit %', v_debit, v_credit;
  end if;
end;
$$;

revoke all on function public.validate_journal_balance(uuid) from public;
grant execute on function public.validate_journal_balance(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Organization membership helper
-- -----------------------------------------------------------------------------
create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $orig$
  select exists (
    select 1
    from public.organization_users ou
    where ou.organization_id = p_organization_id
      and ou.user_id = auth.uid()
      and ou.is_active
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Accounting period lifecycle
--
-- Period writes are intentionally exposed only through these atomic functions.
-- There is deliberately no reopen function: CLOSED is a terminal application
-- state and the period guard below also rejects CLOSED -> OPEN updates.
-- -----------------------------------------------------------------------------
create or replace function public.create_accounting_period(
  p_organization_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $ap$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not public.is_org_member(p_organization_id) then
    raise exception 'not an active organization member';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and o.is_active
  ) then
    raise exception 'organization is inactive';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'accounting period name is required';
  end if;

  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'accounting period start_date must be on or before end_date';
  end if;

  insert into public.accounting_periods (
    organization_id, name, start_date, end_date, status
  )
  values (
    p_organization_id, btrim(p_name), p_start_date, p_end_date,
    'OPEN'::public.accounting_period_status
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'accounting period name already exists for this organization';
  when exclusion_violation then
    raise exception 'accounting period overlaps an existing period for this organization';
end;
$ap$;

revoke all on function public.create_accounting_period(uuid, text, date, date) from public;
grant execute on function public.create_accounting_period(uuid, text, date, date) to authenticated;

create or replace function public.update_accounting_period(
  p_period_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $ap$
declare
  v_period public.accounting_periods%rowtype;
  v_has_journals boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_period
  from public.accounting_periods
  where id = p_period_id
  for update;

  if not found then
    raise exception 'accounting period not found';
  end if;

  if not public.is_org_member(v_period.organization_id) then
    raise exception 'not an active organization member';
  end if;

  if v_period.status <> 'OPEN'::public.accounting_period_status then
    raise exception 'closed accounting periods are read-only and cannot be edited';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'accounting period name is required';
  end if;

  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'accounting period start_date must be on or before end_date';
  end if;

  select exists (
    select 1
    from public.journal_entries je
    where je.organization_id = v_period.organization_id
      and je.accounting_period_id = v_period.id
  ) into v_has_journals;

  if v_has_journals
     and (p_start_date <> v_period.start_date or p_end_date <> v_period.end_date) then
    raise exception 'accounting period dates cannot change after journal entries exist';
  end if;

  update public.accounting_periods
  set name = btrim(p_name),
      start_date = p_start_date,
      end_date = p_end_date
  where id = v_period.id;
exception
  when unique_violation then
    raise exception 'accounting period name already exists for this organization';
  when exclusion_violation then
    raise exception 'accounting period overlaps an existing period for this organization';
end;
$ap$;

revoke all on function public.update_accounting_period(uuid, text, date, date) from public;
grant execute on function public.update_accounting_period(uuid, text, date, date) to authenticated;

create or replace function public.validate_accounting_period_close(p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $ap$
declare
  v_period public.accounting_periods%rowtype;
  v_total bigint;
  v_draft bigint;
  v_out_of_range bigint;
  v_unbalanced bigint;
  v_ready boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_period
  from public.accounting_periods
  where id = p_period_id;

  if not found then
    raise exception 'accounting period not found';
  end if;

  if not public.is_org_member(v_period.organization_id) then
    raise exception 'not an active organization member';
  end if;

  select
    count(*),
    count(*) filter (where je.status = 'DRAFT'::public.document_status),
    count(*) filter (where je.entry_date < v_period.start_date or je.entry_date > v_period.end_date),
    count(*) filter (
      where je.status = 'CONFIRMED'::public.document_status
        and (
          (select count(*) from public.account_transactions at where at.journal_entry_id = je.id) < 2
          or
          (select coalesce(sum(at.debit), 0) from public.account_transactions at where at.journal_entry_id = je.id)
            <> (select coalesce(sum(at.credit), 0) from public.account_transactions at where at.journal_entry_id = je.id)
        )
    )
  into v_total, v_draft, v_out_of_range, v_unbalanced
  from public.journal_entries je
  where je.organization_id = v_period.organization_id
    and je.accounting_period_id = v_period.id;

  v_ready := v_period.status = 'OPEN'::public.accounting_period_status
    and v_draft = 0
    and v_out_of_range = 0
    and v_unbalanced = 0;

  return jsonb_build_object(
    'period_id', v_period.id,
    'status', v_period.status,
    'total_journals', v_total,
    'draft_journals', v_draft,
    'out_of_range_journals', v_out_of_range,
    'unbalanced_confirmed_journals', v_unbalanced,
    'ready_to_close', v_ready
  );
end;
$ap$;

revoke all on function public.validate_accounting_period_close(uuid) from public;
grant execute on function public.validate_accounting_period_close(uuid) to authenticated;

create or replace function public.close_accounting_period(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $ap$
declare
  v_period public.accounting_periods%rowtype;
  v_check jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_period
  from public.accounting_periods
  where id = p_period_id
  for update;

  if not found then
    raise exception 'accounting period not found';
  end if;

  if not public.is_org_member(v_period.organization_id) then
    raise exception 'not an active organization member';
  end if;

  if v_period.status <> 'OPEN'::public.accounting_period_status then
    raise exception 'accounting period is already CLOSED';
  end if;

  v_check := public.validate_accounting_period_close(p_period_id);

  if not coalesce((v_check ->> 'ready_to_close')::boolean, false) then
    raise exception 'accounting period failed close validation: %', v_check;
  end if;

  update public.accounting_periods
  set status = 'CLOSED'::public.accounting_period_status,
      closed_at = now(),
      closed_by = auth.uid()
  where id = v_period.id
    and status = 'OPEN'::public.accounting_period_status;

  if not found then
    raise exception 'accounting period could not be closed';
  end if;
end;
$ap$;

revoke all on function public.close_accounting_period(uuid) from public;
grant execute on function public.close_accounting_period(uuid) to authenticated;

-- A CLOSED period is terminal. Direct SQL/RPC updates cannot reopen or mutate it.
create or replace function public.guard_accounting_period_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $ap$
begin
  if old.status = 'CLOSED'::public.accounting_period_status then
    raise exception 'closed accounting periods are immutable and cannot be reopened or edited';
  end if;

  return new;
end;
$ap$;

revoke all on function public.guard_accounting_period_update() from public;

create trigger accounting_periods_terminal_guard
before update on public.accounting_periods
for each row
execute function public.guard_accounting_period_update();

-- Journal entries must always belong to an OPEN period and their date must be
-- inside that period. The row lock serializes journal writes with period close.
create or replace function public.guard_journal_entry_period()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $ap$
declare
  v_status public.accounting_period_status;
  v_start_date date;
  v_end_date date;
begin
  if tg_op = 'DELETE' then
    select ap.status, ap.start_date, ap.end_date
      into v_status, v_start_date, v_end_date
    from public.accounting_periods ap
    where ap.organization_id = old.organization_id
      and ap.id = old.accounting_period_id
    for update;

    if not found then
      raise exception 'accounting period not found for journal entry';
    end if;

    if v_status <> 'OPEN'::public.accounting_period_status then
      raise exception 'journal entries cannot be deleted from a CLOSED accounting period';
    end if;

    return old;
  end if;

  select ap.status, ap.start_date, ap.end_date
    into v_status, v_start_date, v_end_date
  from public.accounting_periods ap
  where ap.organization_id = new.organization_id
    and ap.id = new.accounting_period_id
  for update;

  if not found then
    raise exception 'accounting period not found for journal entry';
  end if;

  if v_status <> 'OPEN'::public.accounting_period_status then
    raise exception 'journal entries cannot be created or changed in a CLOSED accounting period';
  end if;

  if new.entry_date < v_start_date or new.entry_date > v_end_date then
    raise exception 'journal entry date % is outside accounting period % through %',
      new.entry_date, v_start_date, v_end_date;
  end if;

  return new;
end;
$ap$;

revoke all on function public.guard_journal_entry_period() from public;

create trigger journal_entries_period_guard
before insert or update or delete on public.journal_entries
for each row
execute function public.guard_journal_entry_period();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations','organization_users','units_of_measure','accounting_periods','accounts',
    'products','contacts','number_sequences','journal_entries','account_transactions',
    'purchase','purchase_items','sales','sales_items','inventory_balances','inventory_transactions',
    'expense_categories','expenses','payments','payment_allocations','purchase_returns',
    'purchase_return_items','sales_returns','sales_return_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Organizations: authenticated members may read/update their organization.
-- Creation/onboarding is intentionally not exposed through a generic INSERT policy.
-- A dedicated onboarding RPC should be added after the organization-owner model is finalized.
-- -----------------------------------------------------------------------------
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_org_member(id))
  with check (public.is_org_member(id));

-- Membership: active members can read their memberships; no generic insert/delete/update.
create policy organization_users_select on public.organization_users
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id));

-- -----------------------------------------------------------------------------
-- Master/config tables: member-scoped CRUD.
-- Deletion is intentionally omitted; referenced master data should be deactivated.
-- -----------------------------------------------------------------------------
create policy units_select on public.units_of_measure
  for select to authenticated using (public.is_org_member(organization_id));
create policy units_insert on public.units_of_measure
  for insert to authenticated with check (public.is_org_member(organization_id));
create policy units_update on public.units_of_measure
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy periods_select on public.accounting_periods
  for select to authenticated using (public.is_org_member(organization_id));

create policy accounts_select on public.accounts
  for select to authenticated using (public.is_org_member(organization_id));
create policy accounts_insert on public.accounts
  for insert to authenticated with check (public.is_org_member(organization_id));
create policy accounts_update on public.accounts
  for update to authenticated
  using (public.is_org_member(organization_id) and not is_system_account)
  with check (public.is_org_member(organization_id));

create policy products_select on public.products
  for select to authenticated using (public.is_org_member(organization_id));
create policy products_insert on public.products
  for insert to authenticated with check (public.is_org_member(organization_id));
create policy products_update on public.products
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy contacts_select on public.contacts
  for select to authenticated using (public.is_org_member(organization_id));
create policy contacts_insert on public.contacts
  for insert to authenticated with check (public.is_org_member(organization_id));
create policy contacts_update on public.contacts
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy number_sequences_select on public.number_sequences
  for select to authenticated using (public.is_org_member(organization_id));

create policy expense_categories_select on public.expense_categories
  for select to authenticated using (public.is_org_member(organization_id));
create policy expense_categories_insert on public.expense_categories
  for insert to authenticated with check (public.is_org_member(organization_id));
create policy expense_categories_update on public.expense_categories
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- -----------------------------------------------------------------------------
-- Document tables: read access for members; writes are intentionally limited to
-- DRAFT rows. Confirmation/cancellation must be implemented through atomic RPCs.
-- -----------------------------------------------------------------------------
create policy journal_entries_select on public.journal_entries
  for select to authenticated using (public.is_org_member(organization_id));

create policy journal_entries_insert on public.journal_entries
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and status = 'DRAFT'
    and entry_number is null
    and posted_at is null
  );

create policy journal_entries_update on public.journal_entries
  for update to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT')
  with check (
    public.is_org_member(organization_id)
    and status = 'DRAFT'
    and entry_number is null
    and posted_at is null
  );

create policy journal_entries_delete on public.journal_entries
  for delete to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT');

create policy account_transactions_select on public.account_transactions
  for select to authenticated using (public.is_org_member(organization_id));

-- Ledger rows are immutable and cannot be directly inserted/updated/deleted by the app.

create policy purchase_select on public.purchase
  for select to authenticated using (public.is_org_member(organization_id));
create policy purchase_insert on public.purchase
  for insert to authenticated
  with check (public.is_org_member(organization_id) and status = 'DRAFT' and invoice_id is null and posted_journal_entry_id is null);
create policy purchase_update on public.purchase
  for update to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT')
  with check (public.is_org_member(organization_id) and status = 'DRAFT' and invoice_id is null and posted_journal_entry_id is null);
create policy purchase_delete on public.purchase
  for delete to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT');

create policy purchase_items_select on public.purchase_items
  for select to authenticated using (public.is_org_member(organization_id));
create policy purchase_items_insert on public.purchase_items
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.purchase p where p.organization_id = purchase_items.organization_id and p.id = purchase_id and p.status = 'DRAFT')
  );
create policy purchase_items_update on public.purchase_items
  for update to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (select 1 from public.purchase p where p.organization_id = purchase_items.organization_id and p.id = purchase_id and p.status = 'DRAFT')
  )
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.purchase p where p.organization_id = purchase_items.organization_id and p.id = purchase_id and p.status = 'DRAFT')
  );
create policy purchase_items_delete on public.purchase_items
  for delete to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (select 1 from public.purchase p where p.organization_id = purchase_items.organization_id and p.id = purchase_id and p.status = 'DRAFT')
  );

create policy sales_select on public.sales
  for select to authenticated using (public.is_org_member(organization_id));
create policy sales_insert on public.sales
  for insert to authenticated
  with check (public.is_org_member(organization_id) and status = 'DRAFT' and invoice_id is null and posted_journal_entry_id is null);
create policy sales_update on public.sales
  for update to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT')
  with check (public.is_org_member(organization_id) and status = 'DRAFT' and invoice_id is null and posted_journal_entry_id is null);
create policy sales_delete on public.sales
  for delete to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT');

create policy sales_items_select on public.sales_items
  for select to authenticated using (public.is_org_member(organization_id));
create policy sales_items_insert on public.sales_items
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.sales s where s.organization_id = sales_items.organization_id and s.id = sales_id and s.status = 'DRAFT')
  );
create policy sales_items_update on public.sales_items
  for update to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (select 1 from public.sales s where s.organization_id = sales_items.organization_id and s.id = sales_id and s.status = 'DRAFT')
  )
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.sales s where s.organization_id = sales_items.organization_id and s.id = sales_id and s.status = 'DRAFT')
  );
create policy sales_items_delete on public.sales_items
  for delete to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (select 1 from public.sales s where s.organization_id = sales_items.organization_id and s.id = sales_id and s.status = 'DRAFT')
  );

create policy inventory_balances_select on public.inventory_balances
  for select to authenticated using (public.is_org_member(organization_id));

create policy inventory_transactions_select on public.inventory_transactions
  for select to authenticated using (public.is_org_member(organization_id));

create policy expenses_select on public.expenses
  for select to authenticated using (public.is_org_member(organization_id));
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (public.is_org_member(organization_id) and status = 'DRAFT' and expense_number is null and posted_journal_entry_id is null);
create policy expenses_update on public.expenses
  for update to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT')
  with check (public.is_org_member(organization_id) and status = 'DRAFT' and expense_number is null and posted_journal_entry_id is null);
create policy expenses_delete on public.expenses
  for delete to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT');

create policy payments_select on public.payments
  for select to authenticated using (public.is_org_member(organization_id));
create policy payments_insert on public.payments
  for insert to authenticated
  with check (public.is_org_member(organization_id) and status = 'DRAFT' and payment_number is null and posted_journal_entry_id is null);
create policy payments_update on public.payments
  for update to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT')
  with check (public.is_org_member(organization_id) and status = 'DRAFT' and payment_number is null and posted_journal_entry_id is null);
create policy payments_delete on public.payments
  for delete to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT');

create policy payment_allocations_select on public.payment_allocations
  for select to authenticated using (public.is_org_member(organization_id));

create policy purchase_returns_select on public.purchase_returns
  for select to authenticated using (public.is_org_member(organization_id));
create policy purchase_returns_insert on public.purchase_returns
  for insert to authenticated
  with check (public.is_org_member(organization_id) and status = 'DRAFT' and return_number is null and posted_journal_entry_id is null);
create policy purchase_returns_update on public.purchase_returns
  for update to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT')
  with check (public.is_org_member(organization_id) and status = 'DRAFT' and return_number is null and posted_journal_entry_id is null);
create policy purchase_returns_delete on public.purchase_returns
  for delete to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT');

create policy purchase_return_items_select on public.purchase_return_items
  for select to authenticated using (public.is_org_member(organization_id));
create policy purchase_return_items_insert on public.purchase_return_items
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.purchase_returns r where r.organization_id = purchase_return_items.organization_id and r.id = purchase_return_id and r.status = 'DRAFT')
  );
create policy purchase_return_items_update on public.purchase_return_items
  for update to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (select 1 from public.purchase_returns r where r.organization_id = purchase_return_items.organization_id and r.id = purchase_return_id and r.status = 'DRAFT')
  )
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.purchase_returns r where r.organization_id = purchase_return_items.organization_id and r.id = purchase_return_id and r.status = 'DRAFT')
  );
create policy purchase_return_items_delete on public.purchase_return_items
  for delete to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (select 1 from public.purchase_returns r where r.organization_id = purchase_return_items.organization_id and r.id = purchase_return_id and r.status = 'DRAFT')
  );

create policy sales_returns_select on public.sales_returns
  for select to authenticated using (public.is_org_member(organization_id));
create policy sales_returns_insert on public.sales_returns
  for insert to authenticated
  with check (public.is_org_member(organization_id) and status = 'DRAFT' and return_number is null and posted_journal_entry_id is null);
create policy sales_returns_update on public.sales_returns
  for update to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT')
  with check (public.is_org_member(organization_id) and status = 'DRAFT' and return_number is null and posted_journal_entry_id is null);
create policy sales_returns_delete on public.sales_returns
  for delete to authenticated
  using (public.is_org_member(organization_id) and status = 'DRAFT');

create policy sales_return_items_select on public.sales_return_items
  for select to authenticated using (public.is_org_member(organization_id));
create policy sales_return_items_insert on public.sales_return_items
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.sales_returns r where r.organization_id = sales_return_items.organization_id and r.id = sales_return_id and r.status = 'DRAFT')
  );
create policy sales_return_items_update on public.sales_return_items
  for update to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (select 1 from public.sales_returns r where r.organization_id = sales_return_items.organization_id and r.id = sales_return_id and r.status = 'DRAFT')
  )
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.sales_returns r where r.organization_id = sales_return_items.organization_id and r.id = sales_return_id and r.status = 'DRAFT')
  );
create policy sales_return_items_delete on public.sales_return_items
  for delete to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (select 1 from public.sales_returns r where r.organization_id = sales_return_items.organization_id and r.id = sales_return_id and r.status = 'DRAFT')
  );

-- -----------------------------------------------------------------------------
-- Grants. RLS remains the row-level authorization boundary.
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Ledgers/derived state are readable but not directly writable by the app.
revoke insert, update, delete on public.account_transactions from authenticated;
revoke insert, update, delete on public.inventory_balances from authenticated;
revoke insert, update, delete on public.inventory_transactions from authenticated;
revoke insert, update, delete on public.number_sequences from authenticated;
revoke insert, update, delete on public.accounting_periods from authenticated;
revoke insert, update, delete on public.organization_users from authenticated;
revoke insert, delete on public.organizations from authenticated;

commit;