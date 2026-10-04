-- Pomelo ERP database smoke tests.
-- Executed against a fresh local database after migrations + seed.
-- Keep tests deterministic and independent of production data.

do $$
declare v_count bigint;
begin
  select count(*) into v_count from pg_tables where schemaname='public';
  if v_count <> 24 then raise exception 'Expected exactly 24 public tables, found %', v_count; end if;
end $$;

do $$
declare v_missing text[];
begin
  select array_agg(x) into v_missing
  from unnest(array[
    'organizations','organization_users','units_of_measure','accounting_periods',
    'accounts','products','contacts','number_sequences','journal_entries',
    'account_transactions','purchase','purchase_items','sales','sales_items',
    'inventory_balances','inventory_transactions','expense_categories','expenses',
    'payments','payment_allocations','purchase_returns','purchase_return_items',
    'sales_returns','sales_return_items'
  ]) x
  where not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=x and c.relkind='r'
  );
  if v_missing is not null then raise exception 'Missing public tables: %', v_missing; end if;
end $$;

do $$
declare v_unprotected text[];
begin
  select array_agg(c.relname order by c.relname) into v_unprotected
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
  if v_unprotected is not null then raise exception 'Public tables without RLS: %', v_unprotected; end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and e.enumlabel='POSTED'
  ) then raise exception 'Unexpected POSTED lifecycle state detected'; end if;
end $$;
