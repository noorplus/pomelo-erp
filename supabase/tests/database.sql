-- Pomelo ERP comprehensive transaction/integrity suite.
-- Entirely local/CI. Never targets the production Supabase project.

begin;

select plan(96);

-- ---------------------------------------------------------------------------
-- Schema/security baseline
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::bigint from pg_tables where schemaname='public'),
  24::bigint,
  'exactly 24 public tables'
);

select is(
  (select count(*)::bigint
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and c.relrowsecurity),
  24::bigint,
  'RLS enabled on all public tables'
);

select ok(
  not exists (
    select 1
    from pg_enum e join pg_type t on t.oid=e.enumtypid
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and e.enumlabel='POSTED'
  ),
  'POSTED is not a document lifecycle state'
);

select ok(
  not has_schema_privilege('authenticated','private','USAGE'),
  'private schema is not exposed to authenticated'
);

select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='allocate_number'
  ),
  'public number allocator is not directly exposed'
);

select ok(
  has_table_privilege('authenticated','public.account_transactions','INSERT')
  and has_table_privilege('authenticated','public.account_transactions','UPDATE')
  and has_table_privilege('authenticated','public.account_transactions','DELETE'),
  'authenticated has direct ledger DML under the frozen database grant'
);

select ok(
  not has_table_privilege('authenticated','public.inventory_transactions','INSERT,UPDATE,DELETE'),
  'authenticated cannot directly mutate inventory transactions'
);

select ok(
  not has_table_privilege('authenticated','public.inventory_balances','INSERT,UPDATE,DELETE'),
  'authenticated cannot directly mutate inventory balances'
);

-- ---------------------------------------------------------------------------
-- Authentication / onboarding / master data
-- ---------------------------------------------------------------------------
do $$
declare
  u1 uuid := extensions.gen_random_uuid();
  u2 uuid := extensions.gen_random_uuid();
  u3 uuid := extensions.gen_random_uuid();
  u4 uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at)
  values
    (u1,'authenticated','authenticated','erp-test-1-'||replace(u1::text,'-','')||'@example.test','x',now()),
    (u2,'authenticated','authenticated','erp-test-2-'||replace(u2::text,'-','')||'@example.test','x',now()),
    (u3,'authenticated','authenticated','erp-test-3-'||replace(u3::text,'-','')||'@example.test','x',now()),
    (u4,'authenticated','authenticated','erp-test-4-'||replace(u4::text,'-','')||'@example.test','x',now());

  perform set_config('test.erp_user_1',u1::text,false);
  perform set_config('test.erp_user_2',u2::text,false);
  perform set_config('test.erp_user_3',u3::text,false);
  perform set_config('test.erp_user_4',u4::text,false);
  perform set_config('request.jwt.claim.sub',u1::text,true);
end $$;

set local role authenticated;

select ok(
  public.onboard_organization('ERP Transaction Test') is not null,
  'onboarding creates the organization'
);

select ok(
  exists(
    select 1 from public.organization_users
    where organization_id=(select id from public.organizations where name='ERP Transaction Test')
      and user_id=auth.uid() and is_active
  ),
  'onboarding creates active membership'
);

select is(
  (select count(*)::bigint from public.number_sequences
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')),
  9::bigint,
  'onboarding creates all nine number sequences'
);

select is(
  (select count(*)::bigint from public.accounts
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')),
  10::bigint,
  'onboarding creates baseline chart of accounts'
);

insert into public.contacts(organization_id,name)
select id,'Supplier A' from public.organizations where name='ERP Transaction Test';

insert into public.contacts(organization_id,name)
select id,'Customer A' from public.organizations where name='ERP Transaction Test';

insert into public.products(
  organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id
)
select o.id,'Product A',u.id,inv.id,rev.id,cogs.id
from public.organizations o
join public.units_of_measure u on u.organization_id=o.id and u.name='pcs'
join public.accounts inv on inv.organization_id=o.id and inv.account_code='1200'
join public.accounts rev on rev.organization_id=o.id and rev.account_code='4000'
join public.accounts cogs on cogs.organization_id=o.id and cogs.account_code='5000'
where o.name='ERP Transaction Test';

select is(
  (select product_code from public.products
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   limit 1),
  'PRD-000001',
  'product master receives automatic number'
);

select is(
  (select contact_number from public.contacts
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   order by created_at limit 1),
  'CON-000001',
  'contact master receives automatic number'
);


-- ---------------------------------------------------------------------------
-- Opening initialization: accounting + inventory must be one atomic setup.
-- ---------------------------------------------------------------------------
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and indexname='journal_entries_one_opening_idx'
  ),
  'database enforces one original opening journal per organization'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.post_opening_setup(uuid,date,text,jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated can execute the opening setup RPC'
);

select throws_ok(
  $q$
  insert into public.journal_entries(
    organization_id,accounting_period_id,entry_date,entry_type,status,created_by
  )
  select o.id,ap.id,current_date,'OPENING','DRAFT',auth.uid()
  from public.organizations o
  join public.accounting_periods ap
    on ap.organization_id=o.id and ap.status='OPEN'
  where o.name='ERP Transaction Test'
  $q$,
  '42501',
  'new row violates row-level security policy for table "journal_entries"',
  'authenticated cannot create an OPENING journal directly'
);

-- Use a dedicated third test user so the second user remains available for the
-- later cross-tenant and real-life operator tests.
do $q$
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.erp_user_3'),true);
end $q$;

-- Use a fresh organization for the valid opening setup because the transaction
-- test organization already contains operational journals by this point.
select ok(
  public.onboard_organization('ERP Opening Flow') is not null,
  'opening flow organization is onboarded'
);

insert into public.products(
  organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id
)
select o.id,'Opening Product A',u.id,inv.id,rev.id,cogs.id
from public.organizations o
join public.units_of_measure u on u.organization_id=o.id and u.name='pcs'
join public.accounts inv on inv.organization_id=o.id and inv.account_code='1200'
join public.accounts rev on rev.organization_id=o.id and rev.account_code='4000'
join public.accounts cogs on cogs.organization_id=o.id and cogs.account_code='5000'
where o.name='ERP Opening Flow';

insert into public.products(
  organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id
)
select o.id,'Opening Product B',u.id,inv.id,rev.id,cogs.id
from public.organizations o
join public.units_of_measure u on u.organization_id=o.id and u.name='pcs'
join public.accounts inv on inv.organization_id=o.id and inv.account_code='1200'
join public.accounts rev on rev.organization_id=o.id and rev.account_code='4000'
join public.accounts cogs on cogs.organization_id=o.id and cogs.account_code='5000'
where o.name='ERP Opening Flow';

select ok(
  public.post_opening_setup(
    (select id from public.organizations where name='ERP Opening Flow'),
    current_date,
    'Initial opening balances',
    jsonb_build_array(
      jsonb_build_object(
        'account_id',(select id from public.accounts where organization_id=(select id from public.organizations where name='ERP Opening Flow') and account_code='1000'),
        'debit',10000,'credit',0,'description','Opening cash'
      ),
      jsonb_build_object(
        'account_id',(select id from public.accounts where organization_id=(select id from public.organizations where name='ERP Opening Flow') and account_code='1200'),
        'debit',3500,'credit',0,'description','Opening inventory'
      ),
      jsonb_build_object(
        'account_id',(select id from public.accounts where organization_id=(select id from public.organizations where name='ERP Opening Flow') and account_code='3000'),
        'debit',0,'credit',13500,'description','Opening equity'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'product_id',(select id from public.products where organization_id=(select id from public.organizations where name='ERP Opening Flow') and name='Opening Product A'),
        'quantity',10,'unit_cost',200
      ),
      jsonb_build_object(
        'product_id',(select id from public.products where organization_id=(select id from public.organizations where name='ERP Opening Flow') and name='Opening Product B'),
        'quantity',5,'unit_cost',300
      )
    )
  ) is not null,
  'valid opening accounting and stock setup succeeds atomically'
);

select is(
  (select count(*)::bigint
   from public.journal_entries
   where organization_id=(select id from public.organizations where name='ERP Opening Flow')
     and entry_type='OPENING' and reversal_of_id is null and status='CONFIRMED'),
  1::bigint,
  'opening creates exactly one confirmed original journal'
);

select is(
  (select coalesce(sum(debit),0)-coalesce(sum(credit),0)
   from public.account_transactions
   where organization_id=(select id from public.organizations where name='ERP Opening Flow')
     and journal_entry_id=(select id from public.journal_entries where organization_id=(select id from public.organizations where name='ERP Opening Flow') and entry_type='OPENING' and reversal_of_id is null)),
  0::numeric,
  'opening journal is balanced'
);

select is(
  (select quantity from public.inventory_balances
   where organization_id=(select id from public.organizations where name='ERP Opening Flow')
     and product_id=(select id from public.products where organization_id=(select id from public.organizations where name='ERP Opening Flow') and name='Opening Product A')),
  10::numeric,
  'opening stock initializes product A quantity'
);

select is(
  (select average_cost from public.inventory_balances
   where organization_id=(select id from public.organizations where name='ERP Opening Flow')
     and product_id=(select id from public.products where organization_id=(select id from public.organizations where name='ERP Opening Flow') and name='Opening Product A')),
  200::numeric,
  'opening stock initializes product A weighted-average cost'
);

select is(
  (select quantity from public.inventory_balances
   where organization_id=(select id from public.organizations where name='ERP Opening Flow')
     and product_id=(select id from public.products where organization_id=(select id from public.organizations where name='ERP Opening Flow') and name='Opening Product B')),
  5::numeric,
  'opening stock initializes product B quantity'
);

select is(
  (select average_cost from public.inventory_balances
   where organization_id=(select id from public.organizations where name='ERP Opening Flow')
     and product_id=(select id from public.products where organization_id=(select id from public.organizations where name='ERP Opening Flow') and name='Opening Product B')),
  300::numeric,
  'opening stock initializes product B weighted-average cost'
);

select is(
  (select count(*)::bigint
   from public.inventory_transactions
   where organization_id=(select id from public.organizations where name='ERP Opening Flow')
     and transaction_type='OPENING'
     and direction='IN'),
  2::bigint,
  'opening creates one inventory receipt per product'
);

select is(
  (select coalesce(sum(at.debit-at.credit),0)
   from public.account_transactions at
   join public.accounts a
     on a.organization_id=at.organization_id and a.id=at.account_id
   where at.organization_id=(select id from public.organizations where name='ERP Opening Flow')
     and a.account_code='1200'
     and at.journal_entry_id=(select id from public.journal_entries where organization_id=(select id from public.organizations where name='ERP Opening Flow') and entry_type='OPENING' and reversal_of_id is null)),
  3500::numeric,
  'opening inventory GL equals total opening stock value'
);

select ok(
  not exists (
    select 1
    from public.inventory_transactions it
    where it.organization_id=(select id from public.organizations where name='ERP Opening Flow')
      and (it.reference_type <> 'OPENING'
        or it.reference_id <> (select id from public.journal_entries where organization_id=(select id from public.organizations where name='ERP Opening Flow') and entry_type='OPENING' and reversal_of_id is null))
  ),
  'opening inventory transactions reference the opening journal'
);

select throws_ok(
  $q$select public.post_opening_setup(
    (select id from public.organizations where name='ERP Opening Flow'),
    current_date,
    'Duplicate opening',
    jsonb_build_array(
      jsonb_build_object(
        'account_id',(select id from public.accounts where organization_id=(select id from public.organizations where name='ERP Opening Flow') and account_code='1000'),
        'debit',1,'credit',0
      ),
      jsonb_build_object(
        'account_id',(select id from public.accounts where organization_id=(select id from public.organizations where name='ERP Opening Flow') and account_code='3000'),
        'debit',0,'credit',1
      )
    ),
    '[]'::jsonb
  )$q$,
  'P0001',
  'opening setup has already been initialized',
  'second opening initialization is rejected'
);

select throws_ok(
  $q$select public.cancel_journal_entry(
    (select id from public.journal_entries
     where organization_id=(select id from public.organizations where name='ERP Opening Flow')
       and entry_type='OPENING' and reversal_of_id is null)
  )$q$,
  'P0001',
  'opening journals cannot be cancelled; use an adjustment workflow',
  'opening journal cancellation is blocked'
);

do $q$
begin
  -- Switch to the original owner to verify creator-only authorization.
  perform set_config('request.jwt.claim.sub',current_setting('test.erp_user_1'),true);
end $q$;

select throws_ok(
  $q$select public.post_opening_setup(
    (select id from public.organizations where name='ERP Opening Flow'),
    current_date,
    'Unauthorized opening',
    jsonb_build_array(
      jsonb_build_object(
        'account_id',(select id from public.accounts where organization_id=(select id from public.organizations where name='ERP Opening Flow') and account_code='1000'),
        'debit',1,'credit',0
      ),
      jsonb_build_object(
        'account_id',(select id from public.accounts where organization_id=(select id from public.organizations where name='ERP Opening Flow') and account_code='3000'),
        'debit',0,'credit',1
      )
    ),
    '[]'::jsonb
  )$q$,
  'P0001',
  'only the organization creator can initialize opening balances',
  'non-creator cannot initialize opening balances'
);

do $q$
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.erp_user_4'),true);
end $q$;

select ok(
  public.onboard_organization('ERP Opening Atomicity') is not null,
  'opening atomicity organization is onboarded'
);

insert into public.products(
  organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id
)
select o.id,'Atomicity Product',u.id,inv.id,rev.id,cogs.id
from public.organizations o
join public.units_of_measure u on u.organization_id=o.id and u.name='pcs'
join public.accounts inv on inv.organization_id=o.id and inv.account_code='1200'
join public.accounts rev on rev.organization_id=o.id and rev.account_code='4000'
join public.accounts cogs on cogs.organization_id=o.id and cogs.account_code='5000'
where o.name='ERP Opening Atomicity';

select throws_ok(
  $q$select public.post_opening_setup(
    (select id from public.organizations where name='ERP Opening Atomicity'),
    current_date,
    'Invalid opening',
    jsonb_build_array(
      jsonb_build_object(
        'account_id',(select id from public.accounts where organization_id=(select id from public.organizations where name='ERP Opening Atomicity') and account_code='1200'),
        'debit',100,'credit',0
      ),
      jsonb_build_object(
        'account_id',(select id from public.accounts where organization_id=(select id from public.organizations where name='ERP Opening Atomicity') and account_code='3000'),
        'debit',0,'credit',100
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'product_id',(select id from public.products where organization_id=(select id from public.organizations where name='ERP Opening Atomicity')),
        'quantity',10,'unit_cost',20
      )
    )
  )$q$,
  'P0001',
  'opening stock value must reconcile exactly to inventory-account debits in the opening journal',
  'stock/GL mismatch rejects the entire opening transaction'
);

select is(
  (select count(*)::bigint from public.journal_entries
   where organization_id=(select id from public.organizations where name='ERP Opening Atomicity')),
  0::bigint,
  'failed opening validation leaves no journal'
);

select is(
  (select count(*)::bigint from public.inventory_transactions
   where organization_id=(select id from public.organizations where name='ERP Opening Atomicity')),
  0::bigint,
  'failed opening validation leaves no inventory transaction'
);

-- Return to the original transaction-test owner for the remaining
-- operational transaction coverage.
do $q$
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.erp_user_1'),true);
end $q$;

-- ---------------------------------------------------------------------------
-- Purchase + invoice discount + weighted-average inventory
-- ---------------------------------------------------------------------------
insert into public.purchase(
  organization_id,supplier_id,invoice_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,c.id,current_date,100,10,90,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test';

insert into public.purchase_items(
  organization_id,purchase_id,line_number,product_id,quantity,unit_cost,line_total
)
select p.organization_id,p.id,1,pr.id,10,10,100
from public.purchase p
join public.products pr on pr.organization_id=p.organization_id
where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and p.status='DRAFT';

select ok(
  (select invoice_id from public.purchase
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT') is null,
  'draft purchase has no business number'
);

select public.confirm_purchase(
  (select id from public.purchase
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT')
);

select is(
  (select invoice_id from public.purchase
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='CONFIRMED'),
  'PUR-000001',
  'purchase confirmation allocates PUR number'
);

select is(
  (select line_total from public.purchase_items
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   limit 1),
  100::numeric,
  'purchase source line total remains unchanged after document discount allocation'
);

select is(
  (select inventory_value from public.inventory_balances
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   limit 1),
  90::numeric,
  'purchase inventory value reflects document-level discount'
);

select ok(
  (select sum(debit)=sum(credit)
   from public.account_transactions
   where journal_entry_id=(
     select posted_journal_entry_id from public.purchase
     where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   )),
  'purchase journal is balanced'
);

-- Second purchase at a different cost to exercise weighted average.
insert into public.purchase(
  organization_id,supplier_id,invoice_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,c.id,current_date,200,0,200,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test';

insert into public.purchase_items(
  organization_id,purchase_id,line_number,product_id,quantity,unit_cost,line_total
)
select p.organization_id,p.id,1,pr.id,10,20,200
from public.purchase p
join public.products pr on pr.organization_id=p.organization_id
where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and p.status='DRAFT'
order by p.created_at desc limit 1;

select public.confirm_purchase(
  (select id from public.purchase
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT' and invoice_id is null
   order by created_at desc limit 1)
);

select is(
  (select average_cost from public.inventory_balances
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   limit 1),
  14.5::numeric,
  'weighted-average inventory cost is correct after second receipt'
);

-- ---------------------------------------------------------------------------
-- Sales + COGS + receipt allocation
-- ---------------------------------------------------------------------------
insert into public.sales(  organization_id,customer_id,invoice_date,subtotal,discount_amount,total_amount,
  receivable_account_id,created_by
)
select o.id,c.id,current_date,60,0,60,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Customer A'
join public.accounts a on a.organization_id=o.id and a.account_code='1100'
where o.name='ERP Transaction Test';

insert into public.sales_items(
  organization_id,sales_id,line_number,product_id,quantity,unit_price,line_total
)
select s.organization_id,s.id,1,pr.id,4,15,60
from public.sales s
join public.products pr on pr.organization_id=s.organization_id
where s.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and s.status='DRAFT';

select public.confirm_sales(
  (select id from public.sales
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT')
);

select is(
  (select invoice_id from public.sales
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   order by created_at limit 1),
  'SAL-000001',
  'sales confirmation allocates SAL number'
);

select is(
  (select cogs_total from public.sales_items
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   limit 1),
  58::numeric,
  'sales COGS uses weighted-average inventory cost'
);

select is(
  (select quantity from public.inventory_balances
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   limit 1),
  16::numeric,
  'sales reduces inventory quantity correctly'
);

select ok(
  (select sum(debit)=sum(credit)
   from public.account_transactions
   where journal_entry_id=(
     select posted_journal_entry_id from public.sales
     where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   )),
  'sales journal is balanced'
);

insert into public.payments(
  organization_id,payment_type,contact_id,payment_date,amount,
  account_id,settlement_account_id,created_by
)
select o.id,'RECEIPT',c.id,current_date,60,ar.id,cash.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Customer A'
join public.accounts ar on ar.organization_id=o.id and ar.account_code='1100'
join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000'
where o.name='ERP Transaction Test';

insert into public.payment_allocations(
  organization_id,payment_id,document_type,document_id,allocated_amount
)
select p.organization_id,p.id,'SALES',s.id,60
from public.payments p
join public.sales s on s.organization_id=p.organization_id and s.status='CONFIRMED'
where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and p.status='DRAFT'
  and p.payment_type='RECEIPT';

select public.confirm_payment(
  (select id from public.payments
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT' and payment_type='RECEIPT')
);

select is(
  (select payment_number from public.payments
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and payment_type='RECEIPT'),
  'PAY-000001',
  'receipt confirmation allocates PAY number'
);

select ok(
  (select sum(allocated_amount)
   from public.payment_allocations
   where organization_id=(select id from public.organizations where name='ERP Transaction Test'))=60,
  'sales receipt allocation is persisted exactly'
);

-- ---------------------------------------------------------------------------
-- Expense + payment allocation
-- ---------------------------------------------------------------------------
insert into public.expenses(
  organization_id,expense_category_id,contact_id,payable_account_id,
  expense_date,amount,description,created_by
)
select o.id,ec.id,c.id,a.id,current_date,25,'Test expense',auth.uid()
from public.organizations o
join public.expense_categories ec on ec.organization_id=o.id
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test';

select public.confirm_expense(
  (select id from public.expenses
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT')
);

select is(
  (select expense_number from public.expenses
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')),
  'EXP-000001',
  'expense confirmation allocates EXP number'
);

insert into public.payments(
  organization_id,payment_type,contact_id,payment_date,amount,
  account_id,settlement_account_id,created_by
)
select o.id,'PAYMENT',c.id,current_date,25,ap.id,cash.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts ap on ap.organization_id=o.id and ap.account_code='2000'
join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000'
where o.name='ERP Transaction Test';

insert into public.payment_allocations(
  organization_id,payment_id,document_type,document_id,allocated_amount
)
select p.organization_id,p.id,'EXPENSE',e.id,25
from public.payments p
join public.expenses e on e.organization_id=p.organization_id and e.status='CONFIRMED'
where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and p.status='DRAFT' and p.payment_type='PAYMENT';

select public.confirm_payment(
  (select id from public.payments
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT' and payment_type='PAYMENT')
);

select ok(
  exists(
    select 1 from public.payments
    where organization_id=(select id from public.organizations where name='ERP Transaction Test')
      and payment_number='PAY-000002' and status='CONFIRMED'
  ),
  'expense payment confirmation succeeds'
);

-- ---------------------------------------------------------------------------
-- Purchase return
-- ---------------------------------------------------------------------------
insert into public.purchase_returns(
  organization_id,purchase_id,supplier_id,return_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,p.id,c.id,current_date,20,0,20,a.id,auth.uid()
from public.organizations o
join public.purchase p on p.organization_id=o.id and p.status='CONFIRMED'
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test'
order by p.created_at limit 1;

insert into public.purchase_return_items(
  organization_id,purchase_return_id,line_number,purchase_item_id,product_id,quantity,unit_cost,line_total
)
select r.organization_id,r.id,1,pi.id,pi.product_id,2,10,20
from public.purchase_returns r
join public.purchase_items pi on pi.organization_id=r.organization_id and pi.purchase_id=r.purchase_id
join public.purchase p on p.organization_id=r.organization_id and p.id=r.purchase_id
where r.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and r.status='DRAFT'
order by r.created_at desc limit 1;

select public.confirm_purchase_return(
  (select id from public.purchase_returns
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT')
);

select is(
  (select return_number from public.purchase_returns
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')),
  'PR-000001',
  'purchase return allocates PR number'
);

select is(
  (select quantity from public.inventory_balances
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')),
  14::numeric,
  'purchase return reduces inventory'
);

-- ---------------------------------------------------------------------------
-- Sales return
-- ---------------------------------------------------------------------------
insert into public.sales_returns(
  organization_id,sales_id,customer_id,return_date,subtotal,discount_amount,total_amount,
  receivable_account_id,created_by
)
select o.id,s.id,c.id,current_date,30,0,30,a.id,auth.uid()
from public.organizations o
join public.sales s on s.organization_id=o.id and s.status='CONFIRMED'
join public.contacts c on c.organization_id=o.id and c.name='Customer A'
join public.accounts a on a.organization_id=o.id and a.account_code='1100'
where o.name='ERP Transaction Test'
limit 1;

insert into public.sales_return_items(
  organization_id,sales_return_id,line_number,sales_item_id,product_id,quantity,unit_price,line_total
)
select r.organization_id,r.id,1,si.id,si.product_id,2,15,30
from public.sales_returns r
join public.sales_items si on si.organization_id=r.organization_id and si.sales_id=r.sales_id
where r.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and r.status='DRAFT';

select public.confirm_sales_return(
  (select id from public.sales_returns
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT')
);

select is(
  (select return_number from public.sales_returns
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')),
  'SR-000001',
  'sales return allocates SR number'
);

select is(
  (select quantity from public.inventory_balances
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')),
  16::numeric,
  'sales return restores inventory');

-- ---------------------------------------------------------------------------
-- Manual journal + reversal
-- ---------------------------------------------------------------------------
insert into public.journal_entries(
  organization_id,accounting_period_id,entry_date,entry_type,status,description,created_by
)
select o.id,ap.id,current_date,'ADJUSTMENT','DRAFT','Manual adjustment',auth.uid()
from public.organizations o
join public.accounting_periods ap on ap.organization_id=o.id and ap.status='OPEN'
where o.name='ERP Transaction Test';

insert into public.account_transactions(
  organization_id,journal_entry_id,account_id,line_number,debit,credit,description
)
select j.organization_id,j.id,cash.id,1,50,0,'Manual debit'
from public.journal_entries j
join public.accounts cash on cash.organization_id=j.organization_id and cash.account_code='1000'
where j.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and j.status='DRAFT';

insert into public.account_transactions(
  organization_id,journal_entry_id,account_id,line_number,debit,credit,description
)
select j.organization_id,j.id,equity.id,2,0,50,'Manual credit'
from public.journal_entries j
join public.accounts equity on equity.organization_id=j.organization_id and equity.account_code='3000'
where j.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and j.status='DRAFT';

select public.confirm_journal_entry(
  (select id from public.journal_entries
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and entry_type='ADJUSTMENT' and status='DRAFT')
);

select is(
  (select entry_number from public.journal_entries
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and entry_type='ADJUSTMENT' and status='CONFIRMED'),
  'JE-000009',
  'manual journal receives the next JE number'
);

select public.cancel_journal_entry(
  (select id from public.journal_entries
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and entry_type='ADJUSTMENT' and status='CONFIRMED')
);

select ok(
  exists(
    select 1 from public.journal_entries
    where organization_id=(select id from public.organizations where name='ERP Transaction Test')
      and entry_type='ADJUSTMENT' and status='CANCELLED'
  ),
  'manual journal cancellation creates a reversal lifecycle'
);

-- ---------------------------------------------------------------------------
-- Full cancellation/reversal coverage
-- ---------------------------------------------------------------------------
-- Purchase cancellation
insert into public.products(
  organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id
)
select o.id,'Cancellation Product A',u.id,inv.id,rev.id,cogs.id
from public.organizations o
join public.units_of_measure u on u.organization_id=o.id and u.name='pcs'
join public.accounts inv on inv.organization_id=o.id and inv.account_code='1200'
join public.accounts rev on rev.organization_id=o.id and rev.account_code='4000'
join public.accounts cogs on cogs.organization_id=o.id and cogs.account_code='5000'
where o.name='ERP Transaction Test';

insert into public.purchase(
  organization_id,supplier_id,invoice_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,c.id,current_date,50,0,50,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test';

insert into public.purchase_items(
  organization_id,purchase_id,line_number,product_id,quantity,unit_cost,line_total
)
select p.organization_id,p.id,1,pr.id,5,10,50
from public.purchase p
join public.products pr on pr.organization_id=p.organization_id and pr.name='Cancellation Product A'
where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and p.status='DRAFT'
order by p.created_at desc limit 1;

select public.confirm_purchase(
  (select id from public.purchase where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   and status='DRAFT' order by created_at desc limit 1)
);

select is(
  (select count(*)::bigint
   from public.inventory_transactions it
   join public.products pr on pr.organization_id=it.organization_id and pr.id=it.product_id
   where it.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and pr.name='Cancellation Product A'),
  1::bigint,
  'fresh cancellation product has exactly one inventory movement before cancellation'
);

select public.cancel_purchase(
  (select p.id
   from public.purchase p
   join public.purchase_items pi on pi.organization_id=p.organization_id and pi.purchase_id=p.id
   join public.products pr on pr.organization_id=pi.organization_id and pr.id=pi.product_id
   where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and p.status='CONFIRMED' and pr.name='Cancellation Product A'
   limit 1)
);

select is(
  (select p.status
   from public.purchase p
   join public.purchase_items pi on pi.organization_id=p.organization_id and pi.purchase_id=p.id
   join public.products pr on pr.organization_id=pi.organization_id and pr.id=pi.product_id
   where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and pr.name='Cancellation Product A'
   limit 1),
  'CANCELLED'::public.document_status,
  'purchase cancellation changes status to CANCELLED'
);

select is(
  (select quantity from public.inventory_balances ib
   join public.products pr on pr.organization_id=ib.organization_id and pr.id=ib.product_id
   where ib.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and pr.name='Cancellation Product A'),
  0::numeric,
  'purchase cancellation reverses inventory'
);

-- Sales cancellation
insert into public.contacts(organization_id,name)
select id,'Cancellation Customer' from public.organizations where name='ERP Transaction Test';

insert into public.products(
  organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id
)
select o.id,'Cancellation Product D',u.id,inv.id,rev.id,cogs.id
from public.organizations o
join public.units_of_measure u on u.organization_id=o.id and u.name='pcs'
join public.accounts inv on inv.organization_id=o.id and inv.account_code='1200'
join public.accounts rev on rev.organization_id=o.id and rev.account_code='4000'
join public.accounts cogs on cogs.organization_id=o.id and cogs.account_code='5000'
where o.name='ERP Transaction Test';

insert into public.purchase(
  organization_id,supplier_id,invoice_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,c.id,current_date,10,0,10,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test';

insert into public.purchase_items(
  organization_id,purchase_id,line_number,product_id,quantity,unit_cost,line_total
)
select p.organization_id,p.id,1,pr.id,1,10,10
from public.purchase p
join public.products pr on pr.organization_id=p.organization_id and pr.name='Cancellation Product D'
where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and p.status='DRAFT'
order by p.created_at desc limit 1;

select public.confirm_purchase(
  (select id from public.purchase
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT' and invoice_id is null
   order by created_at desc limit 1)
);

insert into public.sales(
  organization_id,customer_id,invoice_date,subtotal,discount_amount,total_amount,
  receivable_account_id,created_by
)
select o.id,c.id,current_date,15,0,15,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Cancellation Customer'
join public.accounts a on a.organization_id=o.id and a.account_code='1100'
where o.name='ERP Transaction Test';

insert into public.sales_items(
  organization_id,sales_id,line_number,product_id,quantity,unit_price,line_total
)
select s.organization_id,s.id,1,pr.id,1,15,15
from public.sales s
join public.products pr on pr.organization_id=s.organization_id and pr.name='Cancellation Product D'
where s.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and s.status='DRAFT'
order by s.created_at desc limit 1;

select public.confirm_sales(
  (select id from public.sales where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   and status='DRAFT' order by created_at desc limit 1)
);

select public.cancel_sales(
  (select id from public.sales where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   and status='CONFIRMED'
   and customer_id=(select id from public.contacts where organization_id=(select id from public.organizations where name='ERP Transaction Test') and name='Cancellation Customer' order by created_at desc limit 1)
   limit 1)
);

select ok(
  exists(select 1 from public.sales where organization_id=(select id from public.organizations where name='ERP Transaction Test')
         and status='CANCELLED' and invoice_id='SAL-000002'),
  'sales cancellation creates a reversal'
);

select is(
  (select ib.quantity
   from public.inventory_balances ib
   join public.products pr on pr.organization_id=ib.organization_id and pr.id=ib.product_id
   where ib.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and pr.name='Cancellation Product D'),
  1::numeric,
  'sales cancellation restores inventory'
);

-- Expense cancellation
insert into public.expenses(
  organization_id,expense_category_id,contact_id,payable_account_id,
  expense_date,amount,description,created_by
)
select o.id,ec.id,c.id,a.id,current_date,13,'Cancellation expense',auth.uid()
from public.organizations o
join public.expense_categories ec on ec.organization_id=o.id
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test';

select public.confirm_expense(
  (select id from public.expenses where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   and status='DRAFT' and amount=13)
);

select public.cancel_expense(
  (select id from public.expenses where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   and status='CONFIRMED' and amount=13)
);

select ok(  exists(select 1 from public.expenses where organization_id=(select id from public.organizations where name='ERP Transaction Test')
         and status='CANCELLED' and amount=13),
  'expense cancellation creates a reversal'
);

-- Payment cancellation without allocations
insert into public.payments(
  organization_id,payment_type,contact_id,payment_date,amount,
  account_id,settlement_account_id,created_by
)
select o.id,'PAYMENT',c.id,current_date,5,ap.id,cash.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts ap on ap.organization_id=o.id and ap.account_code='2000'
join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000'
where o.name='ERP Transaction Test';

select public.confirm_payment(
  (select id from public.payments where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   and status='DRAFT' and amount=5)
);

select public.cancel_payment(
  (select id from public.payments where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   and status='CONFIRMED' and amount=5)
);

select ok(
  exists(select 1 from public.payments where organization_id=(select id from public.organizations where name='ERP Transaction Test')
         and status='CANCELLED' and amount=5),
  'unallocated payment cancellation creates a reversal'
);

-- Allocated payment cancellation must be blocked.
select throws_ok(
  $q$select public.cancel_payment(
      (select id from public.payments
       where organization_id=(select id from public.organizations where name='ERP Transaction Test')
       and status='CONFIRMED' and amount=25 and payment_type='PAYMENT')
  )$q$,
  'P0001',
  'cannot cancel PAYMENT with payment allocations',
  'allocated payment cannot be cancelled'
);

-- Purchase-return cancellation on a fresh product with no later movement.
insert into public.products(
  organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id
)
select o.id,'Cancellation Product B',u.id,inv.id,rev.id,cogs.id
from public.organizations o
join public.units_of_measure u on u.organization_id=o.id and u.name='pcs'
join public.accounts inv on inv.organization_id=o.id and inv.account_code='1200'
join public.accounts rev on rev.organization_id=o.id and rev.account_code='4000'
join public.accounts cogs on cogs.organization_id=o.id and cogs.account_code='5000'
where o.name='ERP Transaction Test';

insert into public.purchase(
  organization_id,supplier_id,invoice_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,c.id,current_date,40,0,40,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test';

insert into public.purchase_items(
  organization_id,purchase_id,line_number,product_id,quantity,unit_cost,line_total
)
select p.organization_id,p.id,1,pr.id,4,10,40
from public.purchase p
join public.products pr on pr.organization_id=p.organization_id and pr.name='Cancellation Product B'
where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and p.status='DRAFT'
order by p.created_at desc limit 1;

select public.confirm_purchase(
  (select id from public.purchase where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   and status='DRAFT' order by created_at desc limit 1)
);

insert into public.purchase_returns(
  organization_id,purchase_id,supplier_id,return_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,p.id,c.id,current_date,10,0,10,a.id,auth.uid()
from public.organizations o
join public.purchase p on p.organization_id=o.id and p.status='CONFIRMED'
join public.purchase_items pi on pi.organization_id=p.organization_id and pi.purchase_id=p.id
join public.products pr on pr.organization_id=pi.organization_id and pr.id=pi.product_id and pr.name='Cancellation Product B'
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test'
order by p.created_at desc limit 1;

insert into public.purchase_return_items(
  organization_id,purchase_return_id,line_number,purchase_item_id,product_id,quantity,unit_cost,line_total
)
select r.organization_id,r.id,1,pi.id,pi.product_id,1,10,10
from public.purchase_returns r
join public.purchase_items pi on pi.organization_id=r.organization_id and pi.purchase_id=r.purchase_id
where r.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and r.status='DRAFT'
order by r.created_at desc limit 1;

select public.confirm_purchase_return(
  (select r.id
   from public.purchase_returns r
   join public.purchase_return_items ri
     on ri.organization_id=r.organization_id and ri.purchase_return_id=r.id
   join public.products pr
     on pr.organization_id=ri.organization_id and pr.id=ri.product_id and pr.name='Cancellation Product B'
   where r.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and r.status='DRAFT')
);

select public.cancel_purchase_return(
  (select r.id
   from public.purchase_returns r
   join public.purchase_return_items ri
     on ri.organization_id=r.organization_id and ri.purchase_return_id=r.id
   join public.products pr
     on pr.organization_id=ri.organization_id and pr.id=ri.product_id and pr.name='Cancellation Product B'
   where r.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and r.status='CONFIRMED')
);

select ok(
  exists(select 1 from public.purchase_returns where organization_id=(select id from public.organizations where name='ERP Transaction Test')
         and status='CANCELLED'),
  'purchase-return cancellation creates a reversal'
);

-- Sales-return cancellation on another fresh product.
insert into public.products(
  organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id
)
select o.id,'Cancellation Product C',u.id,inv.id,rev.id,cogs.id
from public.organizations o
join public.units_of_measure u on u.organization_id=o.id and u.name='pcs'
join public.accounts inv on inv.organization_id=o.id and inv.account_code='1200'
join public.accounts rev on rev.organization_id=o.id and rev.account_code='4000'
join public.accounts cogs on cogs.organization_id=o.id and cogs.account_code='5000'
where o.name='ERP Transaction Test';

insert into public.purchase(
  organization_id,supplier_id,invoice_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,c.id,current_date,40,0,40,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test';

insert into public.purchase_items(
  organization_id,purchase_id,line_number,product_id,quantity,unit_cost,line_total
)
select p.organization_id,p.id,1,pr.id,4,10,40
from public.purchase p
join public.products pr on pr.organization_id=p.organization_id and pr.name='Cancellation Product C'
where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and p.status='DRAFT'
order by p.created_at desc limit 1;

select public.confirm_purchase(
  (select id from public.purchase where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   and status='DRAFT' order by created_at desc limit 1)
);

insert into public.sales(
  organization_id,customer_id,invoice_date,subtotal,discount_amount,total_amount,
  receivable_account_id,created_by
)
select o.id,c.id,current_date,15,0,15,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Customer A'
join public.accounts a on a.organization_id=o.id and a.account_code='1100'
where o.name='ERP Transaction Test';

insert into public.sales_items(
  organization_id,sales_id,line_number,product_id,quantity,unit_price,line_total
)
select s.organization_id,s.id,1,pr.id,1,15,15
from public.sales s
join public.products pr on pr.organization_id=s.organization_id and pr.name='Cancellation Product C'
where s.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and s.status='DRAFT'
order by s.created_at desc limit 1;

select public.confirm_sales(
  (select id from public.sales where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   and status='DRAFT' order by created_at desc limit 1)
);

insert into public.sales_returns(
  organization_id,sales_id,customer_id,return_date,subtotal,discount_amount,total_amount,
  receivable_account_id,created_by
)
select o.id,s.id,c.id,current_date,15,0,15,a.id,auth.uid()
from public.organizations o
join public.sales s on s.organization_id=o.id and s.status='CONFIRMED'
join public.sales_items si on si.organization_id=s.organization_id and si.sales_id=s.id
join public.products pr on pr.organization_id=si.organization_id and pr.id=si.product_id and pr.name='Cancellation Product C'
join public.contacts c on c.organization_id=o.id and c.name='Customer A'
join public.accounts a on a.organization_id=o.id and a.account_code='1100'
where o.name='ERP Transaction Test'
order by s.created_at desc limit 1;

insert into public.sales_return_items(
  organization_id,sales_return_id,line_number,sales_item_id,product_id,quantity,unit_price,line_total
)
select r.organization_id,r.id,1,si.id,si.product_id,1,15,15
from public.sales_returns r
join public.sales_items si on si.organization_id=r.organization_id and si.sales_id=r.sales_id
where r.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and r.status='DRAFT'
order by r.created_at desc limit 1;

select public.confirm_sales_return(
  (select id from public.sales_returns where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   and status='DRAFT' order by created_at desc limit 1)
);

select public.cancel_sales_return(
  (select id from public.sales_returns where organization_id=(select id from public.organizations where name='ERP Transaction Test')
   and status='CONFIRMED' order by created_at desc limit 1)
);

select ok(
  exists(select 1 from public.sales_returns where organization_id=(select id from public.organizations where name='ERP Transaction Test')
         and status='CANCELLED'),
  'sales-return cancellation creates a reversal'
);

-- ---------------------------------------------------------------------------
-- Failure/rollback paths
-- ---------------------------------------------------------------------------
insert into public.sales(
  organization_id,customer_id,invoice_date,subtotal,discount_amount,total_amount,
  receivable_account_id,created_by
)
select o.id,c.id,current_date,9990,0,9990,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Customer A'
join public.accounts a on a.organization_id=o.id and a.account_code='1100'
where o.name='ERP Transaction Test';

insert into public.sales_items(
  organization_id,sales_id,line_number,product_id,quantity,unit_price,line_total
)
select s.organization_id,s.id,1,pr.id,999,10,9990
from public.sales s
join public.products pr on pr.organization_id=s.organization_id
where s.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and s.status='DRAFT'
order by s.created_at desc limit 1;

select throws_like(
  $q$select public.confirm_sales(
      (select id from public.sales
       where organization_id=(select id from public.organizations where name='ERP Transaction Test')
       and status='DRAFT')
  )$q$,
  '%insufficient inventory%',
  'sales confirmation rejects insufficient inventory and rolls back'
);

select ok(
  (select invoice_id from public.sales
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT') is null,
  'failed sales confirmation leaves draft unnumbered'
);

insert into public.purchase_returns(
  organization_id,purchase_id,supplier_id,return_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,p.id,c.id,current_date,10,0,10,a.id,auth.uid()
from public.organizations o
join public.purchase p on p.organization_id=o.id and p.status='CONFIRMED'
join public.purchase_items pi on pi.organization_id=p.organization_id and pi.purchase_id=p.id
join public.products pr on pr.organization_id=pi.organization_id and pr.id=pi.product_id and pr.name='Cancellation Product B'
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test'
limit 1;

insert into public.purchase_return_items(
  organization_id,purchase_return_id,line_number,purchase_item_id,product_id,quantity,unit_cost,line_total
)
select r.organization_id,r.id,1,pi.id,pi.product_id,1,10,10
from public.purchase_returns r
join public.purchase_items pi on pi.organization_id=r.organization_id and pi.purchase_id=r.purchase_id
join public.products pr on pr.organization_id=pi.organization_id and pr.id=pi.product_id and pr.name='Cancellation Product B'
where r.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and r.status='DRAFT'
order by r.created_at desc limit 1;

select public.confirm_purchase_return(
  (select id from public.purchase_returns
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT'
   order by created_at desc limit 1)
);

insert into public.purchase_returns(
  organization_id,purchase_id,supplier_id,return_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,p.id,c.id,current_date,40,0,40,a.id,auth.uid()
from public.organizations o
join public.purchase p on p.organization_id=o.id and p.status='CONFIRMED'
join public.purchase_items pi on pi.organization_id=p.organization_id and pi.purchase_id=p.id
join public.products pr on pr.organization_id=pi.organization_id and pr.id=pi.product_id and pr.name='Cancellation Product B'
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test'
limit 1;

insert into public.purchase_return_items(
  organization_id,purchase_return_id,line_number,purchase_item_id,product_id,quantity,unit_cost,line_total
)
select r.organization_id,r.id,1,pi.id,pi.product_id,4,10,40
from public.purchase_returns r
join public.purchase_items pi on pi.organization_id=r.organization_id and pi.purchase_id=r.purchase_id
join public.products pr on pr.organization_id=pi.organization_id and pr.id=pi.product_id and pr.name='Cancellation Product B'
where r.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and r.status='DRAFT'
order by r.created_at desc limit 1;

select throws_ok(
  $q$select public.confirm_purchase_return(
      (select id from public.purchase_returns
       where organization_id=(select id from public.organizations where name='ERP Transaction Test')
         and status='DRAFT'
       order by created_at desc limit 1)
  )$q$,
  'P0001',
  'purchase return quantity exceeds purchased quantity',
  'purchase return quantity cannot exceed remaining purchased quantity'
);

select ok(
  row_security_active('public.account_transactions'),
  'ledger row-level security is active'
);

-- ---------------------------------------------------------------------------
-- Purchase payment allocation + settled cancellation guard
-- ---------------------------------------------------------------------------
insert into public.payments(
  organization_id,payment_type,contact_id,payment_date,amount,
  account_id,settlement_account_id,created_by
)
select o.id,'PAYMENT',c.id,current_date,70,ap.id,cash.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts ap on ap.organization_id=o.id and ap.account_code='2000'
join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000'
where o.name='ERP Transaction Test';

insert into public.payment_allocations(
  organization_id,payment_id,document_type,document_id,allocated_amount
)
select p.organization_id,p.id,'PURCHASE',pu.id,70
from public.payments p
join public.purchase pu on pu.organization_id=p.organization_id and pu.status='CONFIRMED'
where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and p.status='DRAFT' and p.payment_type='PAYMENT'
order by pu.created_at limit 1;

select public.confirm_payment(
  (select id from public.payments
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT' and amount=70)
);

select ok(
  exists(
    select 1
    from public.payments p
    join public.payment_allocations pa
      on pa.organization_id=p.organization_id and pa.payment_id=p.id
    where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
      and p.amount=70 and p.status='CONFIRMED'
      and pa.document_type='PURCHASE'
  ),
  'purchase payment allocation confirms'
);

-- ---------------------------------------------------------------------------
-- Settled document cancellation with later inventory movement guard
-- ---------------------------------------------------------------------------
-- Confirmed allocations no longer block document cancellation by themselves.
-- Inventory chronology still prevents cancelling a purchase whose product has
-- later inventory movements, preserving stock-cost integrity.
select throws_like(
  $q$select public.cancel_purchase(
      (select id from public.purchase
       where organization_id=(select id from public.organizations where name='ERP Transaction Test')
       and status='CONFIRMED'
       and exists (
         select 1
         from public.inventory_transactions it
         where it.organization_id=public.purchase.organization_id
           and it.reference_type='PURCHASE'
           and it.reference_id=public.purchase.id
           and exists (
             select 1
             from public.inventory_transactions later
             where later.organization_id=it.organization_id
               and later.product_id=it.product_id
               and later.created_at > it.created_at
           )
       )
       order by created_at limit 1)
  )$q$,
  '%cannot cancel PURCHASE because later inventory movement exists for product%',
  'settled purchase with later inventory movement cannot be cancelled'
);

-- ---------------------------------------------------------------------------
-- Realistic multi-line purchase discount / return / refund scenario
-- ---------------------------------------------------------------------------
insert into public.products(
  organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id
)
select o.id,v.name,u.id,inv.id,rev.id,cogs.id
from public.organizations o
cross join (values ('Discount Product A'),('Discount Product B'),('Discount Product C')) v(name)
join public.units_of_measure u on u.organization_id=o.id and u.name='pcs'
join public.accounts inv on inv.organization_id=o.id and inv.account_code='1200'
join public.accounts rev on rev.organization_id=o.id and rev.account_code='4000'
join public.accounts cogs on cogs.organization_id=o.id and cogs.account_code='5000'
where o.name='ERP Transaction Test';

insert into public.purchase(
  organization_id,supplier_id,invoice_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,c.id,current_date,6000,100,5900,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test';

insert into public.purchase_items(
  organization_id,purchase_id,line_number,product_id,quantity,unit_cost,line_total
)
select p.organization_id,p.id,v.line_number,pr.id,10,v.unit_cost,10*v.unit_cost
from public.purchase p
join (values
  (1,'Discount Product A',100::numeric),
  (2,'Discount Product B',200::numeric),
  (3,'Discount Product C',300::numeric)
) v(line_number,product_name,unit_cost) on true
join public.products pr on pr.organization_id=p.organization_id and pr.name=v.product_name
where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and p.status='DRAFT'
order by p.created_at desc limit 3;

select public.confirm_purchase(
  (select id from public.purchase
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT' and subtotal=6000
   order by created_at desc limit 1)
);

select is(
  (select it.unit_cost
   from public.inventory_transactions it
   join public.products pr on pr.organization_id=it.organization_id and pr.id=it.product_id
   where it.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and it.reference_type='PURCHASE'
     and pr.name='Discount Product A'
   order by it.created_at desc limit 1),
  96.6667::numeric,
  'quantity-based discount gives Product A the effective unit cost'
);

select is(
  (select it.unit_cost
   from public.inventory_transactions it
   join public.products pr on pr.organization_id=it.organization_id and pr.id=it.product_id
   where it.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and it.reference_type='PURCHASE'
     and pr.name='Discount Product B'
   order by it.created_at desc limit 1),
  196.6667::numeric,
  'quantity-based discount gives Product B the effective unit cost'
);

select is(
  (select it.unit_cost
   from public.inventory_transactions it
   join public.products pr on pr.organization_id=it.organization_id and pr.id=it.product_id
   where it.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and it.reference_type='PURCHASE'
     and pr.name='Discount Product C'
   order by it.created_at desc limit 1),
  296.6666::numeric,
  'rounding remainder is absorbed by the final purchase line'
);

select is(
  (select ib.inventory_value
   from public.inventory_balances ib
   join public.products pr on pr.organization_id=ib.organization_id and pr.id=ib.product_id
   where ib.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and pr.name='Discount Product A'),
  966.6670::numeric,
  'Product A inventory value uses discounted cost'
);

select is(
  (select coalesce(sum(ib.inventory_value),0)
   from public.inventory_balances ib
   join public.products pr on pr.organization_id=ib.organization_id and pr.id=ib.product_id
   where ib.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and pr.name like 'Discount Product %'),
  5900.0000::numeric,
  'multi-line purchase inventory value exactly equals net invoice total'
);

insert into public.payments(
  organization_id,payment_type,contact_id,payment_date,amount,
  account_id,settlement_account_id,created_by
)
select o.id,'PAYMENT',c.id,current_date,5900,ap.id,cash.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts ap on ap.organization_id=o.id and ap.account_code='2000'
join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000'
where o.name='ERP Transaction Test';

insert into public.payment_allocations(
  organization_id,payment_id,document_type,document_id,allocated_amount
)
select p.organization_id,p.id,'PURCHASE',pu.id,5900
from public.payments p
join public.purchase pu on pu.organization_id=p.organization_id
  and pu.status='CONFIRMED' and pu.subtotal=6000
where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and p.status='DRAFT' and p.amount=5900;

select public.confirm_payment(
  (select id from public.payments
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT' and amount=5900
   order by created_at desc limit 1)
);

insert into public.purchase_returns(
  organization_id,purchase_id,supplier_id,return_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,p.id,c.id,current_date,393.3334,0,393.3334,a.id,auth.uid()
from public.organizations o
join public.purchase p on p.organization_id=o.id and p.status='CONFIRMED' and p.subtotal=6000
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test';

insert into public.purchase_return_items(
  organization_id,purchase_return_id,line_number,purchase_item_id,product_id,quantity,unit_cost,line_total
)
select r.organization_id,r.id,1,pi.id,pi.product_id,2,196.6667,393.3334
from public.purchase_returns r
join public.purchase_items pi on pi.organization_id=r.organization_id and pi.purchase_id=r.purchase_id
join public.products pr on pr.organization_id=pi.organization_id and pr.id=pi.product_id and pr.name='Discount Product B'
where r.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and r.status='DRAFT'
order by r.created_at desc limit 1;

select public.confirm_purchase_return(
  (select id from public.purchase_returns
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT' and total_amount=393.3334
   order by created_at desc limit 1)
);

select is(
  (select it.unit_cost
   from public.inventory_transactions it
   join public.products pr on pr.organization_id=it.organization_id and pr.id=it.product_id
   where it.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and it.reference_type='PURCHASE_RETURN'
     and pr.name='Discount Product B'
   order by it.created_at desc limit 1),
  196.6667::numeric,
  'purchase return uses original discounted unit cost'
);

select is(
  (select ib.inventory_value
   from public.inventory_balances ib
   join public.products pr on pr.organization_id=ib.organization_id and pr.id=ib.product_id
   where ib.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and pr.name='Discount Product B'),
  1573.3336::numeric,
  'purchase return removes inventory at original discounted cost'
);

insert into public.payments(
  organization_id,payment_type,contact_id,payment_date,amount,
  account_id,settlement_account_id,created_by
)
select o.id,'RECEIPT',c.id,current_date,393.3334,ap.id,cash.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts ap on ap.organization_id=o.id and ap.account_code='2000'
join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000'
where o.name='ERP Transaction Test';

insert into public.payment_allocations(
  organization_id,payment_id,document_type,document_id,allocated_amount
)
select p.organization_id,p.id,'PURCHASE',pu.id,393.3334
from public.payments p
join public.purchase pu on pu.organization_id=p.organization_id and pu.status='CONFIRMED' and pu.subtotal=6000
where p.organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and p.status='DRAFT' and p.payment_type='RECEIPT' and p.amount=393.3334;

select public.confirm_payment(
  (select id from public.payments
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT' and payment_type='RECEIPT' and amount=393.3334
   order by created_at desc limit 1)
);

select is(
  (select coalesce(sum(at.debit-at.credit),0)
   from public.account_transactions at
   join public.journal_entries je
     on je.organization_id=at.organization_id and je.id=at.journal_entry_id
   join public.accounts a
     on a.organization_id=at.organization_id and a.id=at.account_id
   join public.contacts c
     on c.organization_id=at.organization_id and c.id=at.contact_id
   where at.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and a.account_code='2000'
     and c.name='Supplier A'
     and (
       je.reference_id=(select p.id from public.purchase p where p.organization_id=at.organization_id and p.subtotal=6000 limit 1)
       or je.reference_id=(select r.id from public.purchase_returns r where r.organization_id=at.organization_id and r.total_amount=393.3334 limit 1)
       or je.reference_id in (
         select p.id from public.payments p
         where p.organization_id=at.organization_id
           and p.amount in (5900,393.3334)
           and p.status='CONFIRMED'
       )
     )),
  0::numeric,
  'supplier payable is exactly settled with no rounding residual'
);

select is(
  (select coalesce(sum(at.debit-at.credit),0)
   from public.account_transactions at
   join public.journal_entries je on je.organization_id=at.organization_id and je.id=at.journal_entry_id
   where at.organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and je.reference_type='PURCHASE'
     and je.reference_id=(select p.id from public.purchase p where p.organization_id=at.organization_id and p.subtotal=6000 limit 1)),
  0::numeric,
  'discounted purchase and refund leave no residual ledger amount'
);

-- ---------------------------------------------------------------------------
-- Accounting period close and closed-period posting guard
-- ---------------------------------------------------------------------------
insert into public.expenses(
  organization_id,expense_category_id,contact_id,payable_account_id,
  expense_date,amount,description,created_by
)
select o.id,ec.id,c.id,a.id,current_date,12,'Closed period test expense',auth.uid()
from public.organizations o
join public.expense_categories ec on ec.organization_id=o.id
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test';

select public.create_accounting_period(
  (select id from public.organizations where name='ERP Transaction Test'),
  '2027','2027-01-01','2027-12-31'
);

select public.close_accounting_period(
  (select id from public.accounting_periods
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and name='2026')
);

select is(
  (select status from public.accounting_periods
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and name='2026'),
  'CLOSED'::public.accounting_period_status,
  'accounting period closes through controlled RPC'
);

select throws_like(
  $q$select public.confirm_expense(
      (select id from public.expenses
       where organization_id=(select id from public.organizations where name='ERP Transaction Test')
       and status='DRAFT')
  )$q$,
  '%no open accounting period contains%',
  'posting into a closed period is rejected'
);

-- ---------------------------------------------------------------------------
-- Cross-tenant isolation
-- ---------------------------------------------------------------------------
do $q$
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.erp_user_2')::uuid::text,true);
end $q$;

select is(
  (select count(*)::bigint from public.organizations
   where name='ERP Transaction Test'),
  0::bigint,
  'second tenant cannot read first tenant organization'
);

select is(
  (select count(*)::bigint from public.products),
  0::bigint,
  'second tenant cannot read first tenant products'
);

-- Return to owner for final draft lifecycle test.
do $q$
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.erp_user_1')::uuid::text,true);
end $q$;

insert into public.purchase(
  organization_id,supplier_id,invoice_date,subtotal,discount_amount,total_amount,
  payable_account_id,created_by
)
select o.id,c.id,current_date,10,0,10,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Supplier A'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Transaction Test';

select is(
  (select count(*)::bigint from public.purchase
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT' and invoice_id is null),
  1::bigint,
  'draft purchase remains editable and unnumbered'
);

delete from public.purchase
where organization_id=(select id from public.organizations where name='ERP Transaction Test')
  and status='DRAFT' and invoice_id is null;

select is(
  (select count(*)::bigint from public.purchase
   where organization_id=(select id from public.organizations where name='ERP Transaction Test')
     and status='DRAFT' and invoice_id is null),
  0::bigint,
  'draft purchase can be deleted before confirmation'
);


-- ---------------------------------------------------------------------------
-- Real-life end-to-end operator transaction flow
-- ---------------------------------------------------------------------------
do $q$
begin
  -- Reuse the existing second test user; authenticated must not write auth.users.
  perform set_config('request.jwt.claim.sub',current_setting('test.erp_user_2'),true);
end $q$;

select ok(public.onboard_organization('ERP Real Life Flow') is not null,
  'real-life flow: operator can onboard a new organization');

insert into public.contacts(organization_id,name)
select id,'Real Supplier' from public.organizations where name='ERP Real Life Flow';
insert into public.contacts(organization_id,name)
select id,'Real Customer' from public.organizations where name='ERP Real Life Flow';

insert into public.products(organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id)
select o.id,'Real Life Product',u.id,inv.id,rev.id,cogs.id
from public.organizations o
join public.units_of_measure u on u.organization_id=o.id and u.name='pcs'
join public.accounts inv on inv.organization_id=o.id and inv.account_code='1200'
join public.accounts rev on rev.organization_id=o.id and rev.account_code='4000'
join public.accounts cogs on cogs.organization_id=o.id and cogs.account_code='5000'
where o.name='ERP Real Life Flow';

-- Buy 50 @ 200, pay supplier in full, return 10, refund the return.
insert into public.purchase(organization_id,supplier_id,invoice_date,subtotal,discount_amount,total_amount,payable_account_id,created_by)
select o.id,c.id,current_date,10000,0,10000,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Real Supplier'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Real Life Flow';

insert into public.purchase_items(organization_id,purchase_id,line_number,product_id,quantity,unit_cost,line_total)
select p.organization_id,p.id,1,pr.id,50,200,10000
from public.purchase p
join public.products pr on pr.organization_id=p.organization_id and pr.name='Real Life Product'
where p.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
  and p.status='DRAFT';

select public.confirm_purchase((select id from public.purchase
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='DRAFT' order by created_at desc limit 1));

select ok(exists(select 1 from public.purchase
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='CONFIRMED' and total_amount=10000),
 'real-life flow: supplier purchase confirms');

insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id,settlement_account_id,created_by)
select o.id,'PAYMENT',c.id,current_date,10000,ap.id,cash.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Real Supplier'
join public.accounts ap on ap.organization_id=o.id and ap.account_code='2000'
join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000'
where o.name='ERP Real Life Flow';

insert into public.payment_allocations(organization_id,payment_id,document_type,document_id,allocated_amount)
select p.organization_id,p.id,'PURCHASE',pu.id,10000
from public.payments p
join public.purchase pu on pu.organization_id=p.organization_id and pu.status='CONFIRMED'
where p.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
  and p.status='DRAFT' and p.payment_type='PAYMENT' and p.amount=10000;

select public.confirm_payment((select id from public.payments
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='DRAFT' and payment_type='PAYMENT' and amount=10000 order by created_at desc limit 1));

insert into public.purchase_returns(organization_id,purchase_id,supplier_id,return_date,subtotal,discount_amount,total_amount,payable_account_id,created_by)
select o.id,p.id,c.id,current_date,2000,0,2000,a.id,auth.uid()
from public.organizations o
join public.purchase p on p.organization_id=o.id and p.status='CONFIRMED' and p.total_amount=10000
join public.contacts c on c.organization_id=o.id and c.name='Real Supplier'
join public.accounts a on a.organization_id=o.id and a.account_code='2000'
where o.name='ERP Real Life Flow';

insert into public.purchase_return_items(organization_id,purchase_return_id,line_number,purchase_item_id,product_id,quantity,unit_cost,line_total)
select r.organization_id,r.id,1,pi.id,pi.product_id,10,200,2000
from public.purchase_returns r
join public.purchase_items pi on pi.organization_id=r.organization_id and pi.purchase_id=r.purchase_id
where r.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
  and r.status='DRAFT' order by r.created_at desc limit 1;

select public.confirm_purchase_return((select id from public.purchase_returns
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='DRAFT' order by created_at desc limit 1));

insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id,settlement_account_id,created_by)
select o.id,'RECEIPT',c.id,current_date,2000,ap.id,cash.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Real Supplier'
join public.accounts ap on ap.organization_id=o.id and ap.account_code='2000'
join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000'
where o.name='ERP Real Life Flow';

insert into public.payment_allocations(organization_id,payment_id,document_type,document_id,allocated_amount)
select p.organization_id,p.id,'PURCHASE',r.purchase_id,2000
from public.payments p
join public.purchase_returns r on r.organization_id=p.organization_id and r.status='CONFIRMED' and r.total_amount=2000
where p.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
  and p.status='DRAFT' and p.payment_type='RECEIPT' and p.amount=2000;

select public.confirm_payment((select id from public.payments
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='DRAFT' and payment_type='RECEIPT' and amount=2000 order by created_at desc limit 1));

select ok(exists(select 1 from public.payments
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and payment_type='RECEIPT' and amount=2000 and status='CONFIRMED'),
 'real-life flow: supplier refund after purchase return confirms');

-- Sell 20 @ 500, receive 10,000, return 4, refund 2,000.
insert into public.sales(organization_id,customer_id,invoice_date,subtotal,discount_amount,total_amount,receivable_account_id,created_by)
select o.id,c.id,current_date,10000,0,10000,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Real Customer'
join public.accounts a on a.organization_id=o.id and a.account_code='1100'
where o.name='ERP Real Life Flow';

insert into public.sales_items(organization_id,sales_id,line_number,product_id,quantity,unit_price,line_total)
select s.organization_id,s.id,1,pr.id,20,500,10000
from public.sales s
join public.products pr on pr.organization_id=s.organization_id and pr.name='Real Life Product'
where s.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
  and s.status='DRAFT';

select public.confirm_sales((select id from public.sales
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='DRAFT' order by created_at desc limit 1));

insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id,settlement_account_id,created_by)
select o.id,'RECEIPT',c.id,current_date,10000,ar.id,cash.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Real Customer'
join public.accounts ar on ar.organization_id=o.id and ar.account_code='1100'
join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000'
where o.name='ERP Real Life Flow';

insert into public.payment_allocations(organization_id,payment_id,document_type,document_id,allocated_amount)
select p.organization_id,p.id,'SALES',s.id,10000
from public.payments p
join public.sales s on s.organization_id=p.organization_id and s.status='CONFIRMED'
where p.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
  and p.status='DRAFT' and p.payment_type='RECEIPT' and p.amount=10000;

select public.confirm_payment((select id from public.payments
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='DRAFT' and payment_type='RECEIPT' and amount=10000 order by created_at desc limit 1));

insert into public.sales_returns(organization_id,sales_id,customer_id,return_date,subtotal,discount_amount,total_amount,receivable_account_id,created_by)
select o.id,s.id,c.id,current_date,2000,0,2000,a.id,auth.uid()
from public.organizations o
join public.sales s on s.organization_id=o.id and s.status='CONFIRMED' and s.total_amount=10000
join public.contacts c on c.organization_id=o.id and c.name='Real Customer'
join public.accounts a on a.organization_id=o.id and a.account_code='1100'
where o.name='ERP Real Life Flow';

insert into public.sales_return_items(organization_id,sales_return_id,line_number,sales_item_id,product_id,quantity,unit_price,line_total)
select r.organization_id,r.id,1,si.id,si.product_id,4,500,2000
from public.sales_returns r
join public.sales_items si on si.organization_id=r.organization_id and si.sales_id=r.sales_id
where r.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
  and r.status='DRAFT' order by r.created_at desc limit 1;

select public.confirm_sales_return((select id from public.sales_returns
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='DRAFT' order by created_at desc limit 1));

insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id,settlement_account_id,created_by)
select o.id,'PAYMENT',c.id,current_date,2000,ar.id,cash.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Real Customer'
join public.accounts ar on ar.organization_id=o.id and ar.account_code='1100'
join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000'
where o.name='ERP Real Life Flow';

insert into public.payment_allocations(organization_id,payment_id,document_type,document_id,allocated_amount)
select p.organization_id,p.id,'SALES',r.sales_id,2000
from public.payments p
join public.sales_returns r on r.organization_id=p.organization_id and r.status='CONFIRMED' and r.total_amount=2000
where p.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
  and p.status='DRAFT' and p.payment_type='PAYMENT' and p.amount=2000;

select public.confirm_payment((select id from public.payments
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='DRAFT' and payment_type='PAYMENT' and amount=2000 order by created_at desc limit 1));

select ok(exists(select 1 from public.payments
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and payment_type='PAYMENT' and amount=2000 and status='CONFIRMED'),
 'real-life flow: customer refund after sales return confirms');

-- Sell 10 @ 500, receive only 3,000, cancel the sale, refund the partial payment.
insert into public.sales(organization_id,customer_id,invoice_date,subtotal,discount_amount,total_amount,receivable_account_id,created_by)
select o.id,c.id,current_date,5000,0,5000,a.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Real Customer'
join public.accounts a on a.organization_id=o.id and a.account_code='1100'
where o.name='ERP Real Life Flow';

insert into public.sales_items(organization_id,sales_id,line_number,product_id,quantity,unit_price,line_total)
select s.organization_id,s.id,1,pr.id,10,500,5000
from public.sales s
join public.products pr on pr.organization_id=s.organization_id and pr.name='Real Life Product'
where s.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
  and s.status='DRAFT';

select public.confirm_sales((select id from public.sales
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='DRAFT' order by created_at desc limit 1));

insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id,settlement_account_id,created_by)
select o.id,'RECEIPT',c.id,current_date,3000,ar.id,cash.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Real Customer'
join public.accounts ar on ar.organization_id=o.id and ar.account_code='1100'
join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000'
where o.name='ERP Real Life Flow';

insert into public.payment_allocations(organization_id,payment_id,document_type,document_id,allocated_amount)
select p.organization_id,p.id,'SALES',s.id,3000
from public.payments p
join public.sales s on s.organization_id=p.organization_id and s.status='CONFIRMED' and s.total_amount=5000
where p.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
  and p.status='DRAFT' and p.payment_type='RECEIPT' and p.amount=3000;

select public.confirm_payment((select id from public.payments
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='DRAFT' and payment_type='RECEIPT' and amount=3000 order by created_at desc limit 1));

select public.cancel_sales(
  (select id from public.sales
   where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
   and status='CONFIRMED' and total_amount=5000 order by created_at desc limit 1),
  current_date);

insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id,settlement_account_id,created_by)
select o.id,'PAYMENT',c.id,current_date,3000,ar.id,cash.id,auth.uid()
from public.organizations o
join public.contacts c on c.organization_id=o.id and c.name='Real Customer'
join public.accounts ar on ar.organization_id=o.id and ar.account_code='1100'
join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000'
where o.name='ERP Real Life Flow';

insert into public.payment_allocations(organization_id,payment_id,document_type,document_id,allocated_amount)
select p.organization_id,p.id,'SALES',s.id,3000
from public.payments p
join public.sales s on s.organization_id=p.organization_id and s.status='CANCELLED' and s.total_amount=5000
where p.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
  and p.status='DRAFT' and p.payment_type='PAYMENT' and p.amount=3000;

select public.confirm_payment((select id from public.payments
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='DRAFT' and payment_type='PAYMENT' and amount=3000 order by created_at desc limit 1));

select is((select quantity from public.inventory_balances ib
 join public.products pr on pr.organization_id=ib.organization_id and pr.id=ib.product_id
 where ib.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and pr.name='Real Life Product'),24::numeric,
 'real-life flow: final inventory is 24 units');

select is((select coalesce(sum(at.debit-at.credit),0)
 from public.account_transactions at join public.accounts a on a.organization_id=at.organization_id and a.id=at.account_id
 where at.organization_id=(select id from public.organizations where name='ERP Real Life Flow') and a.account_code='2000'),
 0::numeric,'real-life flow: supplier payable is fully settled');

select is((select coalesce(sum(at.debit-at.credit),0)
 from public.account_transactions at join public.accounts a on a.organization_id=at.organization_id and a.id=at.account_id
 where at.organization_id=(select id from public.organizations where name='ERP Real Life Flow') and a.account_code='1100'),
 0::numeric,'real-life flow: customer receivable is fully settled');

select is((select coalesce(sum(at.debit-at.credit),0)
 from public.account_transactions at join public.accounts a on a.organization_id=at.organization_id and a.id=at.account_id
 where at.organization_id=(select id from public.organizations where name='ERP Real Life Flow') and a.account_code='1000'),
 0::numeric,'real-life flow: cash account nets to zero');

select ok(not exists(
 select 1 from public.journal_entries je
 where je.organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and exists(select 1 from public.account_transactions at
   where at.organization_id=je.organization_id and at.journal_entry_id=je.id
   group by at.journal_entry_id having sum(at.debit) <> sum(at.credit))),
 'real-life flow: every generated journal remains balanced');

select ok(exists(
 select 1 from public.sales
 where organization_id=(select id from public.organizations where name='ERP Real Life Flow')
 and status='CANCELLED' and total_amount=5000),
 'real-life flow: partially paid sale can be cancelled');

select * from finish();

rollback;