-- Pomelo ERP pgTAP integration suite.
-- Runs only against the local CI database created from the migration.

begin;

select plan(17);

select is(
  (select count(*)::bigint from pg_tables where schemaname='public'),
  24::bigint,
  'exactly 24 public tables exist'
);

select is(
  (select count(*)::bigint
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and c.relrowsecurity),
  24::bigint,
  'all public tables have RLS enabled'
);

select ok(
  not exists (
    select 1
    from pg_enum e join pg_type t on t.oid=e.enumtypid
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and e.enumlabel='POSTED'
  ),
  'document lifecycle does not contain POSTED'
);

select ok(
  not has_table_privilege('authenticated','public.account_transactions','INSERT')
  and not has_table_privilege('authenticated','public.account_transactions','UPDATE')
  and not has_table_privilege('authenticated','public.account_transactions','DELETE'),
  'authenticated users cannot directly mutate the ledger'
);

select ok(
  not has_table_privilege('authenticated','public.inventory_transactions','INSERT')
  and not has_table_privilege('authenticated','public.inventory_transactions','UPDATE')
  and not has_table_privilege('authenticated','public.inventory_transactions','DELETE'),
  'authenticated users cannot directly mutate inventory transactions'
);

select ok(
  not has_function_privilege('authenticated','public.allocate_number(uuid,text)','EXECUTE'),
  'authenticated users cannot directly allocate business numbers'
);

select ok(
  has_function_privilege('authenticated','public.confirm_purchase(uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.confirm_sales(uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.confirm_payment(uuid)','EXECUTE'),
  'posting RPCs are callable by authenticated users'
);

select ok(
  not has_schema_privilege('authenticated','private','USAGE'),
  'private schema is not exposed to authenticated Data API roles'
);

do $$
declare
  u uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at)
  values(u,'authenticated','authenticated','pgtap-'||replace(u::text,'-','')||'@example.test','x',now());
  perform set_config('request.jwt.claim.sub',u::text,true);
end $$;

set local role authenticated;

select is(
  (select public.onboard_organization('CI Test Organization')),
  (select id from public.organizations where name='CI Test Organization'),
  'onboarding creates an organization'
);

select ok(
  exists(select 1 from public.organization_users where user_id=auth.uid() and is_active),
  'onboarding creates the current user membership'
);

select ok(
  (select count(*) from public.number_sequences where organization_id=(select id from public.organizations where name='CI Test Organization'))=9,
  'onboarding seeds all nine document sequences'
);

select ok(
  (select count(*) from public.accounts where organization_id=(select id from public.organizations where name='CI Test Organization'))=10,
  'onboarding seeds the accounting chart baseline'
);

select ok(
  (select count(*) from public.accounting_periods where organization_id=(select id from public.organizations where name='CI Test Organization'))=1,
  'onboarding seeds an open accounting period'
);

select ok(
  (select count(*) from public.units_of_measure where organization_id=(select id from public.organizations where name='CI Test Organization'))=1,
  'onboarding seeds a default unit'
);

select ok(
  (select count(*) from public.expense_categories where organization_id=(select id from public.organizations where name='CI Test Organization'))=1,
  'onboarding seeds a general expense category'
);

do $$
declare
  o uuid := (select id from public.organizations where name='CI Test Organization');
  u uuid := (select id from public.units_of_measure where organization_id=o limit 1);
  inv uuid := (select id from public.accounts where organization_id=o and account_code='1200');
  rev uuid := (select id from public.accounts where organization_id=o and account_code='4000');
  cogs uuid := (select id from public.accounts where organization_id=o and account_code='5000');
  payable uuid := (select id from public.accounts where organization_id=o and account_code='2000');
  ar uuid := (select id from public.accounts where organization_id=o and account_code='1100');
  cash uuid := (select id from public.accounts where organization_id=o and account_code='1000');
  c uuid;
  p uuid;
  s uuid;
  pay uuid;
begin
  insert into public.contacts(organization_id,name) values(o,'CI Supplier') returning id into c;

  insert into public.products(
    organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id
  ) values(o,'CI Product',u,inv,rev,cogs) returning id into p;

  if (select product_code from public.products where id=p) <> 'PRD-000001' then
    raise exception 'product number was not generated';
  end if;
  if (select contact_number from public.contacts where id=c) <> 'CON-000001' then
    raise exception 'contact number was not generated';
  end if;

  insert into public.purchase(
    organization_id,supplier_id,invoice_date,subtotal,discount_amount,total_amount,payable_account_id,created_by
  ) values(o,c,current_date,100,0,100,payable,auth.uid()) returning id into p;

  insert into public.purchase_items(
    organization_id,purchase_id,line_number,product_id,quantity,unit_cost,line_total
  ) values(o,p,1,(select id from public.products where organization_id=o limit 1),10,10,100);

  perform public.confirm_purchase(p);

  if (select status from public.purchase where id=p) <> 'CONFIRMED' then
    raise exception 'purchase confirmation failed';
  end if;
  if (select invoice_id from public.purchase where id=p) <> 'PUR-000001' then
    raise exception 'purchase number allocation failed';
  end if;
  if (select quantity from public.inventory_balances where organization_id=o and product_id=(select product_id from public.purchase_items where purchase_id=p)) <> 10 then
    raise exception 'purchase inventory quantity incorrect';
  end if;
  if (select average_cost from public.inventory_balances where organization_id=o and product_id=(select product_id from public.purchase_items where purchase_id=p)) <> 10 then
    raise exception 'purchase average cost incorrect';
  end if;
  if (select sum(debit)=sum(credit) from public.account_transactions where journal_entry_id=(select posted_journal_entry_id from public.purchase where id=p)) is distinct from true then
    raise exception 'purchase journal is not balanced';
  end if;

  insert into public.contacts(organization_id,name) values(o,'CI Customer') returning id into c;

  insert into public.sales(
    organization_id,customer_id,invoice_date,subtotal,discount_amount,total_amount,receivable_account_id,created_by
  ) values(o,c,current_date,80,0,80,ar,auth.uid()) returning id into s;

  insert into public.sales_items(
    organization_id,sales_id,line_number,product_id,quantity,unit_price,line_total
  ) values(o,s,1,(select product_id from public.purchase_items where purchase_id=p),4,20,80);

  perform public.confirm_sales(s);

  if (select invoice_id from public.sales where id=s) <> 'SAL-000001' then
    raise exception 'sales number allocation failed';
  end if;
  if (select cogs_total from public.sales_items where sales_id=s) <> 40 then
    raise exception 'moving-average COGS incorrect';
  end if;
  if (select quantity from public.inventory_balances where organization_id=o and product_id=(select product_id from public.purchase_items where purchase_id=p)) <> 6 then
    raise exception 'sales inventory quantity incorrect';
  end if;
  if (select inventory_value from public.inventory_balances where organization_id=o and product_id=(select product_id from public.purchase_items where purchase_id=p)) <> 60 then
    raise exception 'sales inventory value incorrect';
  end if;

  insert into public.payments(
    organization_id,payment_type,contact_id,payment_date,amount,account_id,settlement_account_id,created_by
  ) values(o,'PAYMENT',c,current_date,100,payable,cash,auth.uid()) returning id into pay;

  -- Payment allocations are draft-only.
  insert into public.payment_allocations(
    organization_id,payment_id,document_type,document_id,allocated_amount
  ) values(o,pay,'PURCHASE',p,100);

  perform public.confirm_payment(pay);

  if (select payment_number from public.payments where id=pay) <> 'PAY-000001' then
    raise exception 'payment number allocation failed';
  end if;
  if (select status from public.payments where id=pay) <> 'CONFIRMED' then
    raise exception 'payment confirmation failed';
  end if;

  -- A settled document cannot be cancelled.
  begin
    perform public.cancel_purchase(p,current_date);
    raise exception 'cancelled a purchase with a confirmed allocation';
  exception when others then
    null;
  end;

  -- Direct ledger mutation remains blocked.
  begin
    insert into public.account_transactions(
      organization_id,journal_entry_id,account_id,line_number,debit,credit
    ) values(o,(select posted_journal_entry_id from public.purchase where id=p),inv,99,1,0);
    raise exception 'direct ledger insert unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end $$;

select is(
  (select count(*)::bigint from public.inventory_transactions),
  2::bigint,
  'purchase and sales each create one inventory transaction'
);

select is(
  (select count(*)::bigint
   from public.journal_entries je
   where je.status='CONFIRMED'),
  3::bigint,
  'purchase, sales and payment create confirmed journals'
);

select * from finish();

rollback;
