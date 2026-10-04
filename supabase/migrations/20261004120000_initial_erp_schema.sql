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
set search_path = public, extensions
as $$
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

drop function public.allocate_number(uuid, text);

-- -----------------------------------------------------------------------------
-- Journal validation helper
-- -----------------------------------------------------------------------------
create or replace function public.validate_journal_balance(p_journal_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_lines integer;
  v_debit numeric(30,4);
  v_credit numeric(30,4);
begin
  select je.organization_id into v_org
  from public.journal_entries je
  where je.id = p_journal_entry_id;

  if v_org is null then
    raise exception 'journal entry not found';
  end if;

  if not exists (
    select 1 from public.organization_users ou
    where ou.organization_id = v_org
      and ou.user_id = auth.uid()
      and ou.is_active
  ) then
    raise exception 'not an active organization member';
  end if;

  select count(*), coalesce(sum(at.debit),0), coalesce(sum(at.credit),0)
    into v_lines, v_debit, v_credit
  from public.account_transactions at
  where at.journal_entry_id = p_journal_entry_id;

  if v_lines < 2 then
    raise exception 'journal entry must contain at least two lines';
  end if;

  if v_debit <> v_credit then
    raise exception 'journal entry is not balanced: debit %, credit %', v_debit, v_credit;
  end if;
end;
$$;

revoke all on function public.validate_journal_balance(uuid) from public, anon;
grant execute on function public.validate_journal_balance(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Organization membership helper
-- -----------------------------------------------------------------------------
create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_users ou
    where ou.organization_id = p_organization_id
      and ou.user_id = auth.uid()
      and ou.is_active
  );
$$;

revoke all on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Private transactional engine
-- Privileged writes happen only here. The schema is intentionally not exposed
-- through the Supabase Data API.
-- -----------------------------------------------------------------------------
create schema if not exists private;

create or replace function private.assert_member(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (auth.uid() is null) then
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
end;
$$;

revoke all on function private.assert_member(uuid) from public, anon, authenticated;

create or replace function private.allocate_number(p_organization_id uuid, p_document_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_next bigint;
  v_padding smallint;
  v_result text;
begin
  perform private.assert_member(p_organization_id);

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
     set next_number = v_next + 1, updated_at = now()
   where organization_id = p_organization_id
     and document_type = p_document_type;

  v_result := v_prefix || lpad(v_next::text, v_padding, '0');
  return v_result;
end;
$$;

revoke all on function private.allocate_number(uuid, text) from public, anon, authenticated;

create or replace function private.require_open_period(
  p_organization_id uuid,
  p_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period uuid;
begin
  select ap.id
    into v_period
  from public.accounting_periods ap
  where ap.organization_id = p_organization_id
    and p_date between ap.start_date and ap.end_date
    and ap.status = 'OPEN'
  order by ap.start_date desc
  limit 1
  for update;

  if v_period is null then
    raise exception 'no open accounting period contains %', p_date;
  end if;

  return v_period;
end;
$$;

revoke all on function private.require_open_period(uuid, date) from public, anon, authenticated;

create or replace function private.assert_account_type(
  p_organization_id uuid,
  p_account_id uuid,
  p_expected_type text,
  p_postable boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_postable boolean;
  v_active boolean;
begin
  select a.account_type, a.is_postable, a.is_active
    into v_type, v_postable, v_active
  from public.accounts a
  where a.organization_id = p_organization_id
    and a.id = p_account_id;

  if not found then
    raise exception 'account % not found in organization', p_account_id;
  end if;
  if not v_active then
    raise exception 'account % is inactive', p_account_id;
  end if;
  if p_postable and not v_postable then
    raise exception 'account % is not postable', p_account_id;
  end if;
  if v_type <> p_expected_type then
    raise exception 'account % must be % but is %', p_account_id, p_expected_type, v_type;
  end if;
end;
$$;

revoke all on function private.assert_account_type(uuid, uuid, text, boolean) from public, anon, authenticated;

create or replace function private.post_journal(
  p_organization_id uuid,
  p_entry_date date,
  p_entry_type public.journal_entry_type,
  p_reference_type text,
  p_reference_id uuid,
  p_description text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period uuid;
  v_journal uuid;
  v_number text;
  v_debit numeric(30,4);
  v_credit numeric(30,4);
  v_count integer;
  v_line jsonb;
  v_line_no integer := 0;
  v_account uuid;
  v_contact uuid;
begin
  perform private.assert_member(p_organization_id);
  v_period := private.require_open_period(p_organization_id, p_entry_date);
  v_number := private.allocate_number(p_organization_id, 'JOURNAL_ENTRY');

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'journal requires at least two lines';
  end if;

  select coalesce(sum((x->>'debit')::numeric),0),
         coalesce(sum((x->>'credit')::numeric),0),
         count(*)
    into v_debit, v_credit, v_count
  from jsonb_array_elements(p_lines) x;

  if v_debit <> v_credit then
    raise exception 'journal is not balanced: debit %, credit %', v_debit, v_credit;
  end if;

  insert into public.journal_entries(
    organization_id, entry_number, accounting_period_id, entry_date,
    entry_type, status, reference_type, reference_id, description,
    posted_at, created_by
  )
  values (
    p_organization_id, v_number, v_period, p_entry_date,
    p_entry_type, 'CONFIRMED', p_reference_type, p_reference_id,
    p_description, now(), auth.uid()
  )
  returning id into v_journal;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_line_no := v_line_no + 1;
    v_account := (v_line->>'account_id')::uuid;
    v_contact := nullif(v_line->>'contact_id','')::uuid;

    if not exists (
      select 1 from public.accounts a
      where a.organization_id=p_organization_id
        and a.id=v_account
        and a.is_active
        and a.is_postable
    ) then
      raise exception 'journal account is missing, inactive, or non-postable';
    end if;

    if (v_line->>'debit')::numeric < 0 or (v_line->>'credit')::numeric < 0 then
      raise exception 'journal amounts cannot be negative';
    end if;

    insert into public.account_transactions(
      organization_id, journal_entry_id, account_id, line_number,
      description, debit, credit, contact_id
    )
    values (
      p_organization_id, v_journal, v_account, v_line_no,
      v_line->>'description',
      (v_line->>'debit')::numeric,
      (v_line->>'credit')::numeric,
      v_contact
    );
  end loop;

  return v_journal;
end;
$$;

revoke all on function private.post_journal(uuid,date,public.journal_entry_type,text,uuid,text,jsonb) from public, anon, authenticated;

create or replace function private.inventory_in(
  p_organization_id uuid,
  p_product_id uuid,
  p_date date,
  p_quantity numeric,
  p_unit_cost numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_transaction_number text
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qty numeric(20,4);
  v_value numeric(20,4);
  v_avg numeric(20,4);
  v_new_qty numeric(20,4);
  v_new_value numeric(20,4);
  v_new_avg numeric(20,4);
begin
  if p_quantity <= 0 or p_unit_cost < 0 then
    raise exception 'invalid inventory receipt quantity/cost';
  end if;

  insert into public.inventory_balances(organization_id, product_id)
  values (p_organization_id, p_product_id)
  on conflict (organization_id, product_id) do nothing;

  select ib.quantity, ib.inventory_value, ib.average_cost
    into v_qty, v_value, v_avg
  from public.inventory_balances ib
  where ib.organization_id = p_organization_id
    and ib.product_id = p_product_id
  for update;

  v_new_qty := v_qty + p_quantity;
  v_new_value := v_value + (p_quantity * p_unit_cost);
  v_new_avg := case when v_new_qty = 0 then 0 else round(v_new_value / v_new_qty, 4) end;

  update public.inventory_balances
     set quantity = v_new_qty,
         inventory_value = round(v_new_value,4),
         average_cost = v_new_avg,
         updated_at = now()
   where organization_id = p_organization_id
     and product_id = p_product_id;

  insert into public.inventory_transactions(
    organization_id, transaction_number, product_id, transaction_date,
    transaction_type, direction, quantity, unit_cost, total_value,
    reference_type, reference_id, unit_cost_before, average_cost_after,
    created_by
  )
  values (
    p_organization_id, p_transaction_number, p_product_id, p_date,
    p_reference_type, 'IN', p_quantity, p_unit_cost,
    round(p_quantity * p_unit_cost,4),
    p_reference_type, p_reference_id, v_avg, v_new_avg, auth.uid()
  );

  return round(p_quantity * p_unit_cost,4);
end;
$$;

revoke all on function private.inventory_in(uuid,uuid,date,numeric,numeric,text,uuid,text) from public, anon, authenticated;

create or replace function private.inventory_out(
  p_organization_id uuid,
  p_product_id uuid,
  p_date date,
  p_quantity numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_transaction_number text
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qty numeric(20,4);
  v_value numeric(20,4);
  v_avg numeric(20,4);
  v_cost numeric(20,4);
  v_new_qty numeric(20,4);
  v_new_value numeric(20,4);
begin
  if p_quantity <= 0 then
    raise exception 'invalid inventory issue quantity';
  end if;

  select ib.quantity, ib.inventory_value, ib.average_cost
    into v_qty, v_value, v_avg
  from public.inventory_balances ib
  where ib.organization_id = p_organization_id
    and ib.product_id = p_product_id
  for update;

  if not found or v_qty < p_quantity then
    raise exception 'insufficient inventory for product %: available %, requested %',
      p_product_id, coalesce(v_qty,0), p_quantity;
  end if;

  v_cost := round(p_quantity * v_avg,4);
  v_new_qty := v_qty - p_quantity;
  v_new_value := case when v_new_qty = 0 then 0 else round(v_value - v_cost,4) end;

  update public.inventory_balances
     set quantity = v_new_qty,
         inventory_value = greatest(v_new_value,0),
         average_cost = case when v_new_qty = 0 then 0 else v_avg end,
         updated_at = now()
   where organization_id = p_organization_id
     and product_id = p_product_id;

  insert into public.inventory_transactions(
    organization_id, transaction_number, product_id, transaction_date,
    transaction_type, direction, quantity, unit_cost, total_value,
    reference_type, reference_id, unit_cost_before, average_cost_after,
    created_by
  )
  values (
    p_organization_id, p_transaction_number, p_product_id, p_date,
    p_reference_type, 'OUT', p_quantity, v_avg, v_cost,
    p_reference_type, p_reference_id, v_avg,
    case when v_new_qty = 0 then 0 else v_avg end,
    auth.uid()
  );

  return v_cost;
end;
$$;

revoke all on function private.inventory_out(uuid,uuid,date,numeric,text,uuid,text) from public, anon, authenticated;

create or replace function private.onboard_organization(
  p_name text,
  p_base_currency char(3) default 'BDT',
  p_timezone text default 'Asia/Dhaka'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_period uuid;
  v_year text := to_char(current_date,'YYYY');
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if exists (
    select 1 from public.organization_users
    where user_id = auth.uid() and is_active
  ) then
    raise exception 'user already has an active organization';
  end if;

  insert into public.organizations(name, base_currency, timezone)
  values (p_name, upper(p_base_currency), p_timezone)
  returning id into v_org;

  insert into public.organization_users(organization_id, user_id)
  values (v_org, auth.uid());

  insert into public.accounting_periods(
    organization_id, name, start_date, end_date
  )
  values (
    v_org, v_year,
    make_date(extract(year from current_date)::int,1,1),
    make_date(extract(year from current_date)::int,12,31)
  )
  returning id into v_period;

  insert into public.units_of_measure(organization_id, name)
  values (v_org,'pcs');

  insert into public.accounts(
    organization_id, account_code, account_name, account_type,
    normal_balance, is_control_account, is_system_account, is_postable
  )
  values
    (v_org,'1000','Cash','ASSET','DEBIT',false,true,true),
    (v_org,'1010','Bank','ASSET','DEBIT',false,true,true),
    (v_org,'1100','Accounts Receivable','ASSET','DEBIT',true,true,true),
    (v_org,'1200','Inventory','ASSET','DEBIT',true,true,true),
    (v_org,'2000','Accounts Payable','LIABILITY','CREDIT',true,true,true),
    (v_org,'3000','Owner Equity','EQUITY','CREDIT',false,true,true),
    (v_org,'4000','Sales Revenue','REVENUE','CREDIT',false,true,true),
    (v_org,'5000','Cost of Goods Sold','EXPENSE','DEBIT',false,true,true),
    (v_org,'6000','Operating Expense','EXPENSE','DEBIT',false,true,true),
    (v_org,'6100','Inventory Adjustment','EXPENSE','DEBIT',false,true,true);

  insert into public.expense_categories(
    organization_id, category_code, name, expense_account_id
  )
  select v_org,'GEN','General Expense',a.id
  from public.accounts a
  where a.organization_id=v_org and a.account_code='6000';

  insert into public.number_sequences(
    organization_id, document_type, prefix, next_number, padding
  )
  values
    (v_org,'PRODUCT','PRD-',1,6),
    (v_org,'CONTACT','CON-',1,6),
    (v_org,'PURCHASE','PUR-',1,6),
    (v_org,'PURCHASE_RETURN','PR-',1,6),
    (v_org,'SALES','SAL-',1,6),
    (v_org,'SALES_RETURN','SR-',1,6),
    (v_org,'EXPENSE','EXP-',1,6),
    (v_org,'PAYMENT','PAY-',1,6),
    (v_org,'JOURNAL_ENTRY','JE-',1,6);

  return v_org;
end;
$$;

revoke all on function private.onboard_organization(text,char(3),text) from public, anon, authenticated;

create or replace function public.onboard_organization(
  p_name text,
  p_base_currency char(3) default 'BDT',
  p_timezone text default 'Asia/Dhaka'
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.onboard_organization(p_name,p_base_currency,p_timezone);
$$;

revoke execute on function public.onboard_organization(text,char(3),text) from public, anon;
grant execute on function public.onboard_organization(text,char(3),text) to authenticated;

create or replace function private.confirm_purchase(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.purchase%rowtype;
  i record;
  v_invoice text;
  v_journal uuid;
  v_total numeric(20,4);
  v_alloc numeric(20,4);
  v_running numeric(20,4) := 0;
  v_n integer;
  v_count integer;
  v_inventory_account uuid;
  v_payable text;
  v_tx text;
  v_unit_cost numeric;
begin
  select * into p from public.purchase where id=p_id for update;
  if not found then raise exception 'purchase not found'; end if;
  perform private.assert_member(p.organization_id);
  if p.status <> 'DRAFT' then raise exception 'only draft purchases can be confirmed'; end if;

  select count(*), coalesce(sum(pi.line_total),0)
    into v_count, v_total
  from public.purchase_items pi
  where pi.purchase_id=p.id and pi.organization_id=p.organization_id;

  if v_count=0 or v_total <> p.subtotal then
    raise exception 'purchase subtotal does not match purchase items';
  end if;
  if p.total_amount <> p.subtotal - p.discount_amount then
    raise exception 'purchase total is inconsistent';
  end if;

  perform private.assert_account_type(p.organization_id,p.payable_account_id,'LIABILITY',true);

  v_invoice := private.allocate_number(p.organization_id,'PURCHASE');
  v_payable := p.supplier_id::text;

  if (select count(distinct pr.inventory_account_id)
      from public.purchase_items pi
      join public.products pr on pr.organization_id=pi.organization_id and pr.id=pi.product_id
      where pi.organization_id=p.organization_id and pi.purchase_id=p.id) <> 1 then
    raise exception 'purchase must use one inventory account';
  end if;

  for i in
    select pi.*, pr.inventory_account_id,
           row_number() over(order by pi.line_number) rn,
           count(*) over() cnt
    from public.purchase_items pi
    join public.products pr
      on pr.organization_id=pi.organization_id and pr.id=pi.product_id
    where pi.organization_id=p.organization_id and pi.purchase_id=p.id
    order by pi.line_number
  loop
    if i.rn=i.cnt then
      v_alloc := round(p.total_amount-v_running,4);
    else
      v_alloc := round(i.line_total - (case when p.subtotal=0 then 0 else i.line_total/p.subtotal*p.discount_amount end),4);
      v_running := v_running + v_alloc;
    end if;
    if v_alloc < 0 then raise exception 'purchase discount allocation became negative'; end if;
    perform private.assert_account_type(p.organization_id,i.inventory_account_id,'ASSET',true);
    v_inventory_account := i.inventory_account_id;
    v_tx := v_invoice || '-' || i.line_number::text;
    perform private.inventory_in(p.organization_id,i.product_id,p.invoice_date,i.quantity,
      case when i.quantity=0 then 0 else v_alloc/i.quantity end,'PURCHASE',p.id,v_tx);
    -- Preserve the source line total. The document discount is allocated
    -- only to the inventory valuation and posting amount.
  end loop;

  v_journal := private.post_journal(
    p.organization_id,p.invoice_date,'PURCHASE','PURCHASE',p.id,
    'Purchase '||v_invoice,
    jsonb_build_array(
      jsonb_build_object('account_id',
        v_inventory_account,
        'debit',p.total_amount,'credit',0,'contact_id',p.supplier_id,'description','Inventory purchase'),
      jsonb_build_object('account_id',p.payable_account_id,
        'debit',0,'credit',p.total_amount,'contact_id',p.supplier_id,'description','Accounts payable')
    )
  );

  update public.purchase
     set invoice_id=v_invoice,status='CONFIRMED',posted_journal_entry_id=v_journal,updated_at=now()
   where id=p.id;

  return v_journal;
end;
$$;

revoke all on function private.confirm_purchase(uuid) from public, anon, authenticated;

create or replace function public.confirm_purchase(p_id uuid)
returns uuid language sql security definer set search_path=''
as $$ select private.confirm_purchase(p_id); $$;
revoke execute on function public.confirm_purchase(uuid) from public, anon;
grant execute on function public.confirm_purchase(uuid) to authenticated;

create or replace function private.confirm_sales(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sales%rowtype;
  i record;
  v_invoice text;
  v_journal uuid;
  v_count integer;
  v_subtotal numeric;
  v_revenue_account uuid;
  v_cogs numeric(20,4) := 0;
  v_cost numeric(20,4);
  v_tx text;
begin
  select * into s from public.sales where id=p_id for update;
  if not found then raise exception 'sales document not found'; end if;
  perform private.assert_member(s.organization_id);
  if s.status <> 'DRAFT' then raise exception 'only draft sales can be confirmed'; end if;

  select count(*),coalesce(sum(si.line_total),0)
    into v_count,v_subtotal
  from public.sales_items si
  where si.organization_id=s.organization_id and si.sales_id=s.id;

  if v_count=0 or v_subtotal <> s.subtotal then
    raise exception 'sales subtotal does not match sales items';
  end if;
  if s.total_amount <> s.subtotal-s.discount_amount then
    raise exception 'sales total is inconsistent';
  end if;

  perform private.assert_account_type(s.organization_id,s.receivable_account_id,'ASSET',true);
  if (select count(distinct pr.sales_account_id)
      from public.sales_items si
      join public.products pr on pr.organization_id=si.organization_id and pr.id=si.product_id
      where si.organization_id=s.organization_id and si.sales_id=s.id) <> 1
     or
     (select count(distinct pr.cogs_account_id)
      from public.sales_items si
      join public.products pr on pr.organization_id=si.organization_id and pr.id=si.product_id
      where si.organization_id=s.organization_id and si.sales_id=s.id) <> 1
     or
     (select count(distinct pr.inventory_account_id)
      from public.sales_items si
      join public.products pr on pr.organization_id=si.organization_id and pr.id=si.product_id
      where si.organization_id=s.organization_id and si.sales_id=s.id) <> 1 then
    raise exception 'sales must use one revenue, COGS, and inventory account';
  end if;
  v_invoice := private.allocate_number(s.organization_id,'SALES');

  for i in
    select si.*,pr.inventory_account_id,pr.sales_account_id,pr.cogs_account_id
    from public.sales_items si
    join public.products pr on pr.organization_id=si.organization_id and pr.id=si.product_id
    where si.organization_id=s.organization_id and si.sales_id=s.id
    order by si.line_number
  loop
    v_cost := private.inventory_out(s.organization_id,i.product_id,s.invoice_date,i.quantity,'SALES',s.id,v_invoice||'-'||i.line_number::text);
    v_cogs := v_cogs + v_cost;
    update public.sales_items
       set cogs_unit_cost=case when i.quantity=0 then 0 else round(v_cost/i.quantity,4) end,
           cogs_total=v_cost, updated_at=now()
     where id=i.id;
  end loop;

  perform private.assert_account_type(s.organization_id,
    (select pr.sales_account_id from public.sales_items si
     join public.products pr on pr.organization_id=si.organization_id and pr.id=si.product_id
     where si.sales_id=s.id limit 1),'REVENUE',true);
  perform private.assert_account_type(s.organization_id,
    (select pr.cogs_account_id from public.sales_items si
     join public.products pr on pr.organization_id=si.organization_id and pr.id=si.product_id
     where si.sales_id=s.id limit 1),'EXPENSE',true);
  perform private.assert_account_type(s.organization_id,
    (select pr.inventory_account_id from public.sales_items si
     join public.products pr on pr.organization_id=si.organization_id and pr.id=si.product_id
     where si.sales_id=s.id limit 1),'ASSET',true);

  v_revenue_account := (select pr.sales_account_id
                        from public.sales_items si
                        join public.products pr on pr.organization_id=si.organization_id and pr.id=si.product_id
                        where si.sales_id=s.id limit 1);

  if exists (
    select 1 from public.sales_items si
    join public.products pr on pr.organization_id=si.organization_id and pr.id=si.product_id
    where si.sales_id=s.id and pr.sales_account_id <> v_revenue_account
  ) then
    raise exception 'sales document contains multiple sales accounts; split the document or use one revenue account';
  end if;

  v_journal := private.post_journal(
    s.organization_id,s.invoice_date,'SALES','SALES',s.id,
    'Sales '||v_invoice,
    jsonb_build_array(
      jsonb_build_object('account_id',s.receivable_account_id,'debit',s.total_amount,'credit',0,'contact_id',s.customer_id,'description','Accounts receivable'),
      jsonb_build_object('account_id',v_revenue_account,'debit',0,'credit',s.total_amount,'contact_id',s.customer_id,'description','Sales revenue'),
      jsonb_build_object('account_id',
        (select pr.cogs_account_id from public.sales_items si join public.products pr on pr.organization_id=si.organization_id and pr.id=si.product_id where si.sales_id=s.id limit 1),
        'debit',v_cogs,'credit',0,'contact_id',s.customer_id,'description','Cost of goods sold'),
      jsonb_build_object('account_id',
        (select pr.inventory_account_id from public.sales_items si join public.products pr on pr.organization_id=si.organization_id and pr.id=si.product_id where si.sales_id=s.id limit 1),
        'debit',0,'credit',v_cogs,'contact_id',s.customer_id,'description','Inventory reduction')
    )
  );

  update public.sales
     set invoice_id=v_invoice,status='CONFIRMED',posted_journal_entry_id=v_journal,updated_at=now()
   where id=s.id;

  return v_journal;
end;
$$;

revoke all on function private.confirm_sales(uuid) from public, anon, authenticated;

create or replace function public.confirm_sales(p_id uuid)
returns uuid language sql security definer set search_path=''
as $$ select private.confirm_sales(p_id); $$;
revoke execute on function public.confirm_sales(uuid) from public, anon;
grant execute on function public.confirm_sales(uuid) to authenticated;

create or replace function private.confirm_expense(p_id uuid)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  e public.expenses%rowtype;
  v_num text;
  v_journal uuid;
  v_expense_account uuid;
begin
  select * into e from public.expenses where id=p_id for update;
  if not found then raise exception 'expense not found'; end if;
  perform private.assert_member(e.organization_id);
  if e.status <> 'DRAFT' then raise exception 'only draft expenses can be confirmed'; end if;

  perform private.assert_account_type(e.organization_id,e.payable_account_id,'LIABILITY',true);
  select ec.expense_account_id into v_expense_account
  from public.expense_categories ec
  where ec.organization_id=e.organization_id and ec.id=e.expense_category_id and ec.is_active;
  if v_expense_account is null then raise exception 'expense category is inactive or missing'; end if;
  perform private.assert_account_type(e.organization_id,v_expense_account,'EXPENSE',true);

  v_num:=private.allocate_number(e.organization_id,'EXPENSE');
  v_journal:=private.post_journal(
    e.organization_id,e.expense_date,'EXPENSE','EXPENSE',e.id,
    'Expense '||v_num,
    jsonb_build_array(
      jsonb_build_object('account_id',v_expense_account,'debit',e.amount,'credit',0,'contact_id',e.contact_id,'description',e.description),
      jsonb_build_object('account_id',e.payable_account_id,'debit',0,'credit',e.amount,'contact_id',e.contact_id,'description','Expense payable')
    )
  );

  update public.expenses
     set expense_number=v_num,status='CONFIRMED',posted_journal_entry_id=v_journal,updated_at=now()
   where id=e.id;
  return v_journal;
end;
$$;

revoke all on function private.confirm_expense(uuid) from public, anon, authenticated;

create or replace function public.confirm_expense(p_id uuid)
returns uuid language sql security definer set search_path=''
as $$ select private.confirm_expense(p_id); $$;
revoke execute on function public.confirm_expense(uuid) from public, anon;
grant execute on function public.confirm_expense(uuid) to authenticated;

create or replace function private.confirm_payment(p_id uuid)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  p public.payments%rowtype;
  v_num text;
  v_journal uuid;
  v_alloc numeric(20,4);
  v_expected text;
  v_account_type text;
begin
  select * into p from public.payments where id=p_id for update;
  if not found then raise exception 'payment not found'; end if;
  perform private.assert_member(p.organization_id);
  if p.status <> 'DRAFT' then raise exception 'only draft payments can be confirmed'; end if;

  perform private.assert_account_type(p.organization_id,p.settlement_account_id,'ASSET',true);
  select a.account_type into v_account_type from public.accounts a
  where a.organization_id=p.organization_id and a.id=p.account_id and a.is_active;
  if v_account_type is null then raise exception 'payment account is missing or inactive'; end if;

  v_expected := case when p.payment_type='PAYMENT' then 'LIABILITY' else 'ASSET' end;
  if v_account_type <> v_expected then
    raise exception 'payment counterparty account must be %',v_expected;
  end if;

  select coalesce(sum(pa.allocated_amount),0) into v_alloc
  from public.payment_allocations pa
  where pa.organization_id=p.organization_id and pa.payment_id=p.id;

  if v_alloc > p.amount then
    raise exception 'allocated amount exceeds payment amount';
  end if;

  if p.payment_type='PAYMENT' and exists (
    select 1 from public.payment_allocations pa
    where pa.payment_id=p.id and pa.document_type not in ('PURCHASE','EXPENSE')
  ) then raise exception 'PAYMENT can only allocate to PURCHASE or EXPENSE'; end if;

  if p.payment_type='RECEIPT' and exists (
    select 1 from public.payment_allocations pa
    where pa.payment_id=p.id and pa.document_type <> 'SALES'
  ) then raise exception 'RECEIPT can only allocate to SALES'; end if;

  for v_alloc in
    select pa.allocated_amount
    from public.payment_allocations pa
    where pa.organization_id=p.organization_id and pa.payment_id=p.id
  loop
    if v_alloc <= 0 then raise exception 'payment allocation must be positive'; end if;
  end loop;

  if exists (
    select 1
    from public.payment_allocations pa
    where pa.organization_id=p.organization_id and pa.payment_id=p.id
      and (
        (pa.document_type='PURCHASE' and not exists (
          select 1 from public.purchase d
          where d.organization_id=p.organization_id and d.id=pa.document_id and d.status='CONFIRMED'
            and d.supplier_id=p.contact_id
            and pa.allocated_amount <= d.total_amount - coalesce((
              select sum(pa2.allocated_amount) from public.payment_allocations pa2
              join public.payments p2 on p2.organization_id=pa2.organization_id and p2.id=pa2.payment_id
              where pa2.organization_id=p.organization_id and pa2.document_type='PURCHASE'
                and pa2.document_id=d.id and p2.status='CONFIRMED' and p2.id<>p.id
            ),0)
        ))
        or
        (pa.document_type='EXPENSE' and not exists (
          select 1 from public.expenses d
          where d.organization_id=p.organization_id and d.id=pa.document_id and d.status='CONFIRMED'
            and (d.contact_id is null or d.contact_id=p.contact_id)
            and pa.allocated_amount <= d.amount - coalesce((
              select sum(pa2.allocated_amount) from public.payment_allocations pa2
              join public.payments p2 on p2.organization_id=pa2.organization_id and p2.id=pa2.payment_id
              where pa2.organization_id=p.organization_id and pa2.document_type='EXPENSE'
                and pa2.document_id=d.id and p2.status='CONFIRMED' and p2.id<>p.id
            ),0)
        ))
        or
        (pa.document_type='SALES' and not exists (
          select 1 from public.sales d
          where d.organization_id=p.organization_id and d.id=pa.document_id and d.status='CONFIRMED'
            and d.customer_id=p.contact_id
            and pa.allocated_amount <= d.total_amount - coalesce((
              select sum(pa2.allocated_amount) from public.payment_allocations pa2
              join public.payments p2 on p2.organization_id=pa2.organization_id and p2.id=pa2.payment_id
              where pa2.organization_id=p.organization_id and pa2.document_type='SALES'
                and pa2.document_id=d.id and p2.status='CONFIRMED' and p2.id<>p.id
            ),0)
        ))
      )
  ) then
    raise exception 'payment allocation is invalid, over-allocated, or document/contact does not match';
  end if;

  v_num:=private.allocate_number(p.organization_id,'PAYMENT');

  if p.payment_type='PAYMENT' then
    v_journal:=private.post_journal(
      p.organization_id,p.payment_date,'PAYMENT','PAYMENT',p.id,'Payment '||v_num,
      jsonb_build_array(
        jsonb_build_object('account_id',p.account_id,'debit',p.amount,'credit',0,'contact_id',p.contact_id,'description','Payable settlement'),
        jsonb_build_object('account_id',p.settlement_account_id,'debit',0,'credit',p.amount,'contact_id',p.contact_id,'description','Cash/bank payment')
      )
    );
  else
    v_journal:=private.post_journal(
      p.organization_id,p.payment_date,'PAYMENT','PAYMENT',p.id,'Receipt '||v_num,
      jsonb_build_array(
        jsonb_build_object('account_id',p.settlement_account_id,'debit',p.amount,'credit',0,'contact_id',p.contact_id,'description','Cash/bank receipt'),
        jsonb_build_object('account_id',p.account_id,'debit',0,'credit',p.amount,'contact_id',p.contact_id,'description','Receivable settlement')
      )
    );
  end if;

  update public.payments
     set payment_number=v_num,status='CONFIRMED',posted_journal_entry_id=v_journal,updated_at=now()
   where id=p.id;
  return v_journal;
end;
$$;

revoke all on function private.confirm_payment(uuid) from public, anon, authenticated;

create or replace function public.confirm_payment(p_id uuid)
returns uuid language sql security definer set search_path=''
as $$ select private.confirm_payment(p_id); $$;
revoke execute on function public.confirm_payment(uuid) from public, anon;
grant execute on function public.confirm_payment(uuid) to authenticated;

create or replace function private.confirm_purchase_return(p_id uuid)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  r public.purchase_returns%rowtype;
  i record;
  v_num text;
  v_journal uuid;
  v_total numeric:=0;
  v_inventory_account uuid;
  v_running numeric:=0;
  v_count integer:=0;
begin
  select * into r from public.purchase_returns where id=p_id for update;
  if not found then raise exception 'purchase return not found'; end if;
  perform private.assert_member(r.organization_id);
  if r.status <> 'DRAFT' then raise exception 'only draft purchase returns can be confirmed'; end if;

  select coalesce(sum(pri.line_total),0), count(*) into v_total,v_count
  from public.purchase_return_items pri
  where pri.organization_id=r.organization_id and pri.purchase_return_id=r.id;
  if v_count=0 or v_total <> r.subtotal then
    raise exception 'purchase return subtotal does not match items';
  end if;
  if r.total_amount <> r.subtotal-r.discount_amount then raise exception 'purchase return total is inconsistent'; end if;
  if not exists(select 1 from public.purchase p where p.organization_id=r.organization_id and p.id=r.purchase_id and p.status='CONFIRMED' and p.supplier_id=r.supplier_id) then
    raise exception 'purchase return must reference a confirmed purchase for the same supplier';
  end if;
  perform private.assert_account_type(r.organization_id,r.payable_account_id,'LIABILITY',true);

  v_num:=private.allocate_number(r.organization_id,'PURCHASE_RETURN');

  if (select count(distinct pr.inventory_account_id)
      from public.purchase_return_items pri
      join public.products pr on pr.organization_id=pri.organization_id and pr.id=pri.product_id
      where pri.organization_id=r.organization_id and pri.purchase_return_id=r.id) <> 1 then
    raise exception 'purchase return must use one inventory account';
  end if;

  for i in
    select pri.*,pi.purchase_id,pr.inventory_account_id,
           row_number() over(order by pri.line_number) rn,
           count(*) over() cnt
    from public.purchase_return_items pri
    join public.purchase_items pi on pi.organization_id=pri.organization_id and pi.id=pri.purchase_item_id
    join public.products pr on pr.organization_id=pri.organization_id and pr.id=pri.product_id
    where pri.organization_id=r.organization_id and pri.purchase_return_id=r.id
    order by pri.line_number
  loop
    if i.purchase_id <> r.purchase_id then raise exception 'purchase return line references another purchase'; end if;
    if i.quantity > (
      (select pi0.quantity from public.purchase_items pi0
       where pi0.organization_id=r.organization_id and pi0.id=i.purchase_item_id)
      - coalesce((
        select sum(pri2.quantity)
        from public.purchase_return_items pri2
        join public.purchase_returns rr
          on rr.organization_id=pri2.organization_id and rr.id=pri2.purchase_return_id
        where pri2.organization_id=r.organization_id
          and pri2.purchase_item_id=i.purchase_item_id
          and rr.purchase_id=r.purchase_id
          and rr.status='CONFIRMED'
          and rr.id<>r.id
      ),0)
    ) then
      raise exception 'purchase return quantity exceeds purchased quantity';
    end if;
    if i.product_id <> (select pi2.product_id from public.purchase_items pi2 where pi2.organization_id=r.organization_id and pi2.id=i.purchase_item_id) then
      raise exception 'purchase return product does not match original purchase item';
    end if;
    if i.rn=i.cnt then
      i.line_total := round(r.total_amount-v_running,4);
    else
      i.line_total := round(i.line_total-(case when r.subtotal=0 then 0 else i.line_total/r.subtotal*r.discount_amount end),4);
      v_running := v_running+i.line_total;
    end if;
    if i.line_total < 0 then raise exception 'purchase return discount allocation became negative'; end if;
    perform private.inventory_out(
      r.organization_id,i.product_id,r.return_date,i.quantity,
      case when i.quantity=0 then 0 else i.line_total/i.quantity end,
      'PURCHASE_RETURN',r.id,v_num||'-'||i.line_number::text
    );
    v_inventory_account:=i.inventory_account_id;
  end loop;

  v_journal:=private.post_journal(
    r.organization_id,r.return_date,'PURCHASE_RETURN','PURCHASE_RETURN',r.id,
    'Purchase return '||v_num,
    jsonb_build_array(
      jsonb_build_object('account_id',r.payable_account_id,'debit',r.total_amount,'credit',0,'contact_id',r.supplier_id,'description','Purchase return payable reduction'),
      jsonb_build_object('account_id',v_inventory_account,'debit',0,'credit',r.total_amount,'contact_id',r.supplier_id,'description','Inventory returned')
    )
  );

  update public.purchase_returns set return_number=v_num,status='CONFIRMED',posted_journal_entry_id=v_journal,updated_at=now() where id=r.id;
  return v_journal;
end;
$$;

revoke all on function private.confirm_purchase_return(uuid) from public, anon, authenticated;

create or replace function public.confirm_purchase_return(p_id uuid)
returns uuid language sql security definer set search_path=''
as $$ select private.confirm_purchase_return(p_id); $$;
revoke execute on function public.confirm_purchase_return(uuid) from public, anon;
grant execute on function public.confirm_purchase_return(uuid) to authenticated;

create or replace function private.confirm_sales_return(p_id uuid)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  r public.sales_returns%rowtype;
  i record;
  v_num text;
  v_journal uuid;
  v_cogs numeric:=0;
  v_inventory_account uuid;
  v_cogs_account uuid;
  v_sales_account uuid;
begin
  select * into r from public.sales_returns where id=p_id for update;
  if not found then raise exception 'sales return not found'; end if;
  perform private.assert_member(r.organization_id);
  if r.status <> 'DRAFT' then raise exception 'only draft sales returns can be confirmed'; end if;

  if coalesce((select sum(sri.line_total) from public.sales_return_items sri where sri.organization_id=r.organization_id and sri.sales_return_id=r.id),0) <> r.subtotal then
    raise exception 'sales return subtotal does not match items';
  end if;
  if r.total_amount <> r.subtotal-r.discount_amount then raise exception 'sales return total is inconsistent'; end if;
  if not exists(select 1 from public.sales s where s.organization_id=r.organization_id and s.id=r.sales_id and s.status='CONFIRMED' and s.customer_id=r.customer_id) then
    raise exception 'sales return must reference a confirmed sale for the same customer';
  end if;
  perform private.assert_account_type(r.organization_id,r.receivable_account_id,'ASSET',true);

  v_num:=private.allocate_number(r.organization_id,'SALES_RETURN');

  for i in
    select sri.*,si.cogs_unit_cost as original_cogs,pr.inventory_account_id,pr.cogs_account_id,pr.sales_account_id
    from public.sales_return_items sri
    join public.sales_items si on si.organization_id=sri.organization_id and si.id=sri.sales_item_id
    join public.products pr on pr.organization_id=sri.organization_id and pr.id=sri.product_id
    where sri.organization_id=r.organization_id and sri.sales_return_id=r.id
    order by sri.line_number
  loop
    if i.sales_id <> r.sales_id then raise exception 'sales return line references another sale'; end if;
    if i.quantity > (
      (select si0.quantity from public.sales_items si0
       where si0.organization_id=r.organization_id and si0.id=i.sales_item_id)
      - coalesce((
        select sum(sri2.quantity)
        from public.sales_return_items sri2
        join public.sales_returns rr
          on rr.organization_id=sri2.organization_id and rr.id=sri2.sales_return_id
        where sri2.organization_id=r.organization_id
          and sri2.sales_item_id=i.sales_item_id
          and rr.sales_id=r.sales_id
          and rr.status='CONFIRMED'
          and rr.id<>r.id
      ),0)
    ) then
      raise exception 'sales return quantity exceeds sold quantity';
    end if;
    if i.original_cogs is null then raise exception 'sales item cost is missing'; end if;
    perform private.inventory_in(r.organization_id,i.product_id,r.return_date,i.quantity,i.original_cogs,'SALES_RETURN',r.id,v_num||'-'||i.line_number::text);
    v_cogs:=v_cogs + round(i.quantity*i.original_cogs,4);
    v_inventory_account:=i.inventory_account_id;
    v_cogs_account:=i.cogs_account_id;
    v_sales_account:=i.sales_account_id;
    update public.sales_return_items set cogs_unit_cost=i.original_cogs,cogs_total=round(i.quantity*i.original_cogs,4),updated_at=now() where id=i.id;
  end loop;

  v_journal:=private.post_journal(
    r.organization_id,r.return_date,'SALES_RETURN','SALES_RETURN',r.id,
    'Sales return '||v_num,
    jsonb_build_array(
      jsonb_build_object('account_id',r.receivable_account_id,'debit',0,'credit',r.total_amount,'contact_id',r.customer_id,'description','Customer credit'),
      jsonb_build_object('account_id',v_sales_account,'debit',r.total_amount,'credit',0,'contact_id',r.customer_id,'description','Sales return'),
      jsonb_build_object('account_id',v_inventory_account,'debit',v_cogs,'credit',0,'contact_id',r.customer_id,'description','Inventory returned'),
      jsonb_build_object('account_id',v_cogs_account,'debit',0,'credit',v_cogs,'contact_id',r.customer_id,'description','COGS reversal')
    )
  );

  update public.sales_returns set return_number=v_num,status='CONFIRMED',posted_journal_entry_id=v_journal,updated_at=now() where id=r.id;
  return v_journal;
end;
$$;

revoke all on function private.confirm_sales_return(uuid) from public, anon, authenticated;

create or replace function public.confirm_sales_return(p_id uuid)
returns uuid language sql security definer set search_path=''
as $$ select private.confirm_sales_return(p_id); $$;
revoke execute on function public.confirm_sales_return(uuid) from public, anon;
grant execute on function public.confirm_sales_return(uuid) to authenticated;

create or replace function private.cancel_document(
  p_kind text,
  p_id uuid,
  p_cancel_date date default current_date
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_org uuid;
  v_status public.document_status;
  v_original_journal uuid;
  v_reversal uuid;
  v_period uuid;
  v_type public.journal_entry_type;
  v_number text;
  v_doc_number text;
  v_line record;
  v_tx record;
  v_new_tx text;
  v_qty numeric;
  v_value numeric;
  v_avg numeric;
  v_new_qty numeric;
  v_new_value numeric;
  v_inventory_account uuid;
  v_adjustment_account uuid;
begin
  if p_kind not in ('PURCHASE','SALES','EXPENSE','PAYMENT','PURCHASE_RETURN','SALES_RETURN') then
    raise exception 'unsupported document type';
  end if;

  if p_kind='PURCHASE' then
    select organization_id,status,posted_journal_entry_id,invoice_id into v_org,v_status,v_original_journal,v_doc_number from public.purchase where id=p_id for update;
  elsif p_kind='SALES' then
    select organization_id,status,posted_journal_entry_id,invoice_id into v_org,v_status,v_original_journal,v_doc_number from public.sales where id=p_id for update;
  elsif p_kind='EXPENSE' then
    select organization_id,status,posted_journal_entry_id,expense_number into v_org,v_status,v_original_journal,v_doc_number from public.expenses where id=p_id for update;
  elsif p_kind='PAYMENT' then
    select organization_id,status,posted_journal_entry_id,payment_number into v_org,v_status,v_original_journal,v_doc_number from public.payments where id=p_id for update;
  elsif p_kind='PURCHASE_RETURN' then
    select organization_id,status,posted_journal_entry_id,return_number into v_org,v_status,v_original_journal,v_doc_number from public.purchase_returns where id=p_id for update;
  else
    select organization_id,status,posted_journal_entry_id,return_number into v_org,v_status,v_original_journal,v_doc_number from public.sales_returns where id=p_id for update;
  end if;

  if v_org is null then raise exception 'document not found'; end if;
  perform private.assert_member(v_org);
  if v_status <> 'CONFIRMED' then raise exception 'only confirmed documents can be cancelled'; end if;

  v_period := private.require_open_period(v_org,p_cancel_date);

  if p_kind='PAYMENT' and exists (
    select 1
    from public.payment_allocations pa
    where pa.organization_id=v_org
      and pa.payment_id=p_id
  ) then
    raise exception 'cannot cancel PAYMENT with payment allocations';
  end if;

  if p_kind in ('PURCHASE','SALES','EXPENSE') and exists (
    select 1
    from public.payment_allocations pa
    join public.payments py
      on py.organization_id=pa.organization_id and py.id=pa.payment_id
    where pa.organization_id=v_org
      and pa.document_type=p_kind
      and pa.document_id=p_id
      and py.status='CONFIRMED'
  ) then
    raise exception 'cannot cancel % with confirmed payment allocations',p_kind;
  end if;

  select je.entry_type into v_type from public.journal_entries je where je.organization_id=v_org and je.id=v_original_journal;
  v_number := private.allocate_number(v_org,'JOURNAL_ENTRY');

  insert into public.journal_entries(
    organization_id,entry_number,accounting_period_id,entry_date,entry_type,status,
    reference_type,reference_id,description,posted_at,reversal_of_id,created_by
  )
  values(v_org,v_number,v_period,p_cancel_date,v_type,'CANCELLED',
         p_kind,p_id,'Reversal of '||v_doc_number,now(),v_original_journal,auth.uid())
  returning id into v_reversal;

  for v_line in
    select at.account_id,at.line_number,at.description,at.debit,at.credit,at.contact_id
    from public.account_transactions at
    where at.organization_id=v_org and at.journal_entry_id=v_original_journal
    order by at.line_number
  loop
    insert into public.account_transactions(
      organization_id,journal_entry_id,account_id,line_number,description,
      debit,credit,contact_id
    )
    values(v_org,v_reversal,v_line.account_id,v_line.line_number,
           'Reversal: '||coalesce(v_line.description,''),
           v_line.credit,v_line.debit,v_line.contact_id);
  end loop;

  for v_tx in
    select * from public.inventory_transactions it
    where it.organization_id=v_org and it.reference_id=p_id
      and it.reference_type=p_kind
    order by it.created_at desc
  loop
    if exists (
      select 1
      from public.inventory_transactions later
      where later.organization_id=v_org
        and later.product_id=v_tx.product_id
        and (later.created_at > v_tx.created_at or (later.created_at=v_tx.created_at and later.id<>v_tx.id))
    ) then
      raise exception 'cannot cancel % because later inventory movement exists for product %',p_kind,v_tx.product_id;
    end if;

    select ib.quantity,ib.inventory_value,ib.average_cost
      into v_qty,v_value,v_avg
    from public.inventory_balances ib
    where ib.organization_id=v_org and ib.product_id=v_tx.product_id
    for update;

    if v_tx.direction='IN' then
      if v_qty < v_tx.quantity then
        raise exception 'cannot reverse inventory receipt; current stock is insufficient';
      end if;
      v_new_qty:=v_qty-v_tx.quantity;
      v_new_value:=case when v_new_qty=0 then 0 else round(v_value-v_tx.total_value,4) end;
    else
      v_new_qty:=v_qty+v_tx.quantity;
      v_new_value:=round(v_value+v_tx.total_value,4);
    end if;

    update public.inventory_balances
       set quantity=v_new_qty,
           inventory_value=greatest(v_new_value,0),
           average_cost=case when v_new_qty=0 then 0 else round(v_new_value/v_new_qty,4) end,
           updated_at=now()
     where organization_id=v_org and product_id=v_tx.product_id;

    v_new_tx:='REV-'||v_tx.transaction_number;
    insert into public.inventory_transactions(
      organization_id,transaction_number,product_id,transaction_date,transaction_type,direction,
      quantity,unit_cost,total_value,reference_type,reference_id,unit_cost_before,average_cost_after,created_by
    )
    values(
      v_org,v_new_tx,v_tx.product_id,p_cancel_date,'CANCELLATION',
      case when v_tx.direction='IN' then 'OUT' else 'IN' end,
      v_tx.quantity,v_tx.unit_cost,v_tx.total_value,'CANCELLATION',p_id,v_avg,
      case when v_new_qty=0 then 0 else round(v_new_value/v_new_qty,4) end,auth.uid()
    );
  end loop;

  if p_kind='PURCHASE' then
    update public.purchase set status='CANCELLED',updated_at=now() where id=p_id;
  elsif p_kind='SALES' then
    update public.sales set status='CANCELLED',updated_at=now() where id=p_id;
  elsif p_kind='EXPENSE' then
    update public.expenses set status='CANCELLED',updated_at=now() where id=p_id;
  elsif p_kind='PAYMENT' then
    update public.payments set status='CANCELLED',updated_at=now() where id=p_id;
  elsif p_kind='PURCHASE_RETURN' then
    update public.purchase_returns set status='CANCELLED',updated_at=now() where id=p_id;
  else
    update public.sales_returns set status='CANCELLED',updated_at=now() where id=p_id;
  end if;

  return v_reversal;
end;
$$;

revoke all on function private.cancel_document(text,uuid,date) from public, anon, authenticated;

create or replace function public.cancel_purchase(p_id uuid,p_cancel_date date default current_date)
returns uuid language sql security definer set search_path=''
as $$ select private.cancel_document('PURCHASE',p_id,p_cancel_date); $$;
create or replace function public.cancel_sales(p_id uuid,p_cancel_date date default current_date)
returns uuid language sql security definer set search_path=''
as $$ select private.cancel_document('SALES',p_id,p_cancel_date); $$;
create or replace function public.cancel_expense(p_id uuid,p_cancel_date date default current_date)
returns uuid language sql security definer set search_path=''
as $$ select private.cancel_document('EXPENSE',p_id,p_cancel_date); $$;
create or replace function public.cancel_payment(p_id uuid,p_cancel_date date default current_date)
returns uuid language sql security definer set search_path=''
as $$ select private.cancel_document('PAYMENT',p_id,p_cancel_date); $$;
create or replace function public.cancel_purchase_return(p_id uuid,p_cancel_date date default current_date)
returns uuid language sql security definer set search_path=''
as $$ select private.cancel_document('PURCHASE_RETURN',p_id,p_cancel_date); $$;
create or replace function public.cancel_sales_return(p_id uuid,p_cancel_date date default current_date)
returns uuid language sql security definer set search_path=''
as $$ select private.cancel_document('SALES_RETURN',p_id,p_cancel_date); $$;

revoke execute on function public.cancel_purchase(uuid,date),
  public.cancel_sales(uuid,date),
  public.cancel_expense(uuid,date),
  public.cancel_payment(uuid,date),
  public.cancel_purchase_return(uuid,date),
  public.cancel_sales_return(uuid,date)
from public, anon;
grant execute on function public.cancel_purchase(uuid,date),
  public.cancel_sales(uuid,date),
  public.cancel_expense(uuid,date),
  public.cancel_payment(uuid,date),
  public.cancel_purchase_return(uuid,date),
  public.cancel_sales_return(uuid,date)
to authenticated;



-- Automatic master numbering. Product/contact numbers are assigned at insert
-- time; transactional document numbers are assigned only on confirmation.
create or replace function private.assign_master_number()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if TG_TABLE_NAME='products' and NEW.product_code is null then
    NEW.product_code := private.allocate_number(NEW.organization_id,'PRODUCT');
  elsif TG_TABLE_NAME='contacts' and NEW.contact_number is null then
    NEW.contact_number := private.allocate_number(NEW.organization_id,'CONTACT');
  end if;
  return NEW;
end;
$$;

revoke all on function private.assign_master_number() from public, anon, authenticated;

drop trigger if exists products_assign_number on public.products;
create trigger products_assign_number
before insert on public.products
for each row execute function private.assign_master_number();

drop trigger if exists contacts_assign_number on public.contacts;
create trigger contacts_assign_number
before insert on public.contacts
for each row execute function private.assign_master_number();


-- -----------------------------------------------------------------------------
-- Controlled accounting period creation
-- -----------------------------------------------------------------------------
create or replace function private.create_accounting_period(
  p_organization_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
begin
  perform private.assert_member(p_organization_id);
  if p_start_date>p_end_date then raise exception 'period start date must not exceed end date'; end if;
  insert into public.accounting_periods(organization_id,name,start_date,end_date,status)
  values(p_organization_id,p_name,p_start_date,p_end_date,'OPEN')
  returning id into v_id;
  return v_id;
end;
$;

revoke all on function private.create_accounting_period(uuid,text,date,date) from public,anon,authenticated;

create or replace function public.create_accounting_period(
  p_name text,p_start_date date,p_end_date date
)
returns uuid
language sql
security definer
set search_path=''
as $$
  select private.create_accounting_period(
    (select ou.organization_id from public.organization_users ou
     where ou.user_id=auth.uid() and ou.is_active
     order by ou.created_at limit 1),
    p_name,p_start_date,p_end_date
  );
$;

revoke execute on function public.create_accounting_period(text,date,date) from public,anon;
grant execute on function public.create_accounting_period(text,date,date) to authenticated;

-- -----------------------------------------------------------------------------
-- Controlled accounting period close
-- -----------------------------------------------------------------------------
create or replace function private.close_period(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid;
  v_status public.accounting_period_status;
begin
  select organization_id,status into v_org,v_status
  from public.accounting_periods
  where id=p_period_id
  for update;

  if v_org is null then raise exception 'accounting period not found'; end if;
  perform private.assert_member(v_org);

  if v_status='CLOSED' then
    raise exception 'accounting period is already closed';
  end if;

  if exists (
    select 1
    from public.journal_entries je
    where je.organization_id=v_org
      and je.accounting_period_id=p_period_id
      and je.status='DRAFT'
  ) then
    raise exception 'cannot close period with draft journal entries';
  end if;

  update public.accounting_periods
     set status='CLOSED',closed_at=now(),closed_by=auth.uid(),updated_at=now()
   where id=p_period_id;
end;
$$;

revoke all on function private.close_period(uuid) from public,anon,authenticated;

create or replace function public.close_accounting_period(p_period_id uuid)
returns void
language sql
security definer
set search_path=''
as $$ select private.close_period(p_period_id); $$;

revoke execute on function public.close_accounting_period(uuid) from public,anon;
grant execute on function public.close_accounting_period(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Controlled manual journal lifecycle
-- -----------------------------------------------------------------------------
create or replace function private.confirm_journal_entry(p_journal_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  j public.journal_entries%rowtype;
  v_number text;
  v_debit numeric(30,4);
  v_credit numeric(30,4);
  v_lines integer;
begin
  select * into j
  from public.journal_entries
  where id=p_journal_entry_id
  for update;

  if not found then raise exception 'journal entry not found'; end if;
  perform private.assert_member(j.organization_id);

  if j.status <> 'DRAFT' then raise exception 'only draft journal entries can be confirmed'; end if;
  if j.entry_type not in ('OPENING','ADJUSTMENT','OTHER') then
    raise exception 'manual confirmation is limited to OPENING, ADJUSTMENT or OTHER journals';
  end if;

  perform private.require_open_period(j.organization_id,j.entry_date);

  select count(*),coalesce(sum(at.debit),0),coalesce(sum(at.credit),0)
    into v_lines,v_debit,v_credit
  from public.account_transactions at
  where at.organization_id=j.organization_id and at.journal_entry_id=j.id;

  if v_lines<2 then raise exception 'journal entry requires at least two lines'; end if;
  if v_debit<>v_credit then raise exception 'journal entry is not balanced'; end if;

  if exists (
    select 1
    from public.account_transactions at
    where at.organization_id=j.organization_id
      and at.journal_entry_id=j.id
      and not exists (
        select 1 from public.accounts a
        where a.organization_id=j.organization_id
          and a.id=at.account_id
          and a.is_active
          and a.is_postable
      )
  ) then
    raise exception 'manual journal contains an inactive or non-postable account';
  end if;

  v_number:=private.allocate_number(j.organization_id,'JOURNAL_ENTRY');

  update public.journal_entries
     set entry_number=v_number,status='CONFIRMED',posted_at=now(),updated_at=now()
   where id=j.id;

  return j.id;
end;
$$;

revoke all on function private.confirm_journal_entry(uuid) from public,anon,authenticated;

create or replace function public.confirm_journal_entry(p_journal_entry_id uuid)
returns uuid
language sql
security definer
set search_path=''
as $$ select private.confirm_journal_entry(p_journal_entry_id); $$;

revoke execute on function public.confirm_journal_entry(uuid) from public,anon;
grant execute on function public.confirm_journal_entry(uuid) to authenticated;

create or replace function private.cancel_journal_entry(p_journal_entry_id uuid,p_cancel_date date default current_date)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  j public.journal_entries%rowtype;
  v_period uuid;
  v_number text;
  v_reversal uuid;
  v_line record;
begin
  select * into j
  from public.journal_entries
  where id=p_journal_entry_id
  for update;

  if not found then raise exception 'journal entry not found'; end if;
  perform private.assert_member(j.organization_id);
  if j.status <> 'CONFIRMED' then raise exception 'only confirmed journals can be cancelled'; end if;

  v_period:=private.require_open_period(j.organization_id,p_cancel_date);
  v_number:=private.allocate_number(j.organization_id,'JOURNAL_ENTRY');

  insert into public.journal_entries(
    organization_id,entry_number,accounting_period_id,entry_date,entry_type,status,
    reference_type,reference_id,description,posted_at,reversal_of_id,created_by
  )
  values(
    j.organization_id,v_number,v_period,p_cancel_date,j.entry_type,'CANCELLED',
    'JOURNAL',j.id,'Reversal of '||coalesce(j.entry_number,''),now(),j.id,auth.uid()
  )
  returning id into v_reversal;

  for v_line in
    select account_id,line_number,description,debit,credit,contact_id
    from public.account_transactions
    where organization_id=j.organization_id and journal_entry_id=j.id
    order by line_number
  loop
    insert into public.account_transactions(
      organization_id,journal_entry_id,account_id,line_number,description,
      debit,credit,contact_id
    )
    values(
      j.organization_id,v_reversal,v_line.account_id,v_line.line_number,
      'Reversal: '||coalesce(v_line.description,''),
      v_line.credit,v_line.debit,v_line.contact_id
    );
  end loop;

  update public.journal_entries
     set status='CANCELLED',updated_at=now()
   where id=j.id;

  return v_reversal;
end;
$;

revoke all on function private.cancel_journal_entry(uuid,date) from public,anon,authenticated;

create or replace function public.cancel_journal_entry(p_journal_entry_id uuid,p_cancel_date date default current_date)
returns uuid
language sql
security definer
set search_path=''
as $$ select private.cancel_journal_entry(p_journal_entry_id,p_cancel_date); $$;

revoke execute on function public.cancel_journal_entry(uuid,date) from public,anon;
grant execute on function public.cancel_journal_entry(uuid,date) to authenticated;

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
create policy account_transactions_insert_draft on public.account_transactions
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and exists (
      select 1 from public.journal_entries je
      where je.organization_id=account_transactions.organization_id
        and je.id=journal_entry_id
        and je.status='DRAFT'
        and je.entry_type in ('OPENING','ADJUSTMENT','OTHER')
    )
  );
create policy account_transactions_update_draft on public.account_transactions
  for update to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (
      select 1 from public.journal_entries je
      where je.organization_id=account_transactions.organization_id
        and je.id=journal_entry_id
        and je.status='DRAFT'
        and je.entry_type in ('OPENING','ADJUSTMENT','OTHER')
    )
  )
  with check (
    public.is_org_member(organization_id)
    and exists (
      select 1 from public.journal_entries je
      where je.organization_id=account_transactions.organization_id
        and je.id=journal_entry_id
        and je.status='DRAFT'
        and je.entry_type in ('OPENING','ADJUSTMENT','OTHER')
    )
  );
create policy account_transactions_delete_draft on public.account_transactions
  for delete to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (
      select 1 from public.journal_entries je
      where je.organization_id=account_transactions.organization_id
        and je.id=journal_entry_id
        and je.status='DRAFT'
        and je.entry_type in ('OPENING','ADJUSTMENT','OTHER')
    )
  );

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
create policy payment_allocations_insert on public.payment_allocations
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and exists (
      select 1 from public.payments p
      where p.organization_id=payment_allocations.organization_id
        and p.id=payment_id
        and p.status='DRAFT'
    )
  );
create policy payment_allocations_update on public.payment_allocations
  for update to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (
      select 1 from public.payments p
      where p.organization_id=payment_allocations.organization_id
        and p.id=payment_id
        and p.status='DRAFT'
    )
  )
  with check (
    public.is_org_member(organization_id)
    and exists (
      select 1 from public.payments p
      where p.organization_id=payment_allocations.organization_id
        and p.id=payment_id
        and p.status='DRAFT'
    )
  );
create policy payment_allocations_delete on public.payment_allocations
  for delete to authenticated
  using (
    public.is_org_member(organization_id)
    and exists (
      select 1 from public.payments p
      where p.organization_id=payment_allocations.organization_id
        and p.id=payment_id
        and p.status='DRAFT'
    )
  );

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