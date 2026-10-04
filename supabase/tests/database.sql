-- Pomelo ERP pgTAP database smoke tests.
-- These tests run after migrations and seed data on a fresh local database.

begin;

select plan(6);

select is(
  (select count(*)::bigint from pg_tables where schemaname = 'public'),
  24::bigint,
  'exactly 24 public tables exist'
);

select is(
  (select count(*)::bigint
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relrowsecurity),
  24::bigint,
  'all 24 public tables have RLS enabled'
);

select ok(
  not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and e.enumlabel = 'POSTED'
  ),
  'document lifecycle does not contain POSTED'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.is_org_member(uuid)',
    'EXECUTE'
  ),
  'organization membership helper is callable by authenticated users'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.account_transactions',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.account_transactions',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.account_transactions',
    'DELETE'
  ),
  'authenticated users cannot directly mutate the accounting ledger'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.inventory_transactions',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.inventory_transactions',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.inventory_transactions',
    'DELETE'
  ),
  'authenticated users cannot directly mutate inventory transactions'
);

select * from finish();

rollback;
