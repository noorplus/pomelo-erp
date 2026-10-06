-- Pomelo ERP real-life organization-user acceptance test.
-- Test-only: disposable/local Supabase, transaction rolled back at the end.

begin;
select plan(28);

do $$
declare c uuid := extensions.gen_random_uuid(); s uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at) values
    (c,'authenticated','authenticated','acceptance-owner-'||replace(c::text,'-','')||'@example.test','x',now()),
    (s,'authenticated','authenticated','acceptance-staff-'||replace(s::text,'-','')||'@example.test','x',now());
  perform set_config('test.acceptance_creator',c::text,false);
  perform set_config('test.acceptance_staff',s::text,false);
  perform set_config('test.acceptance_staff_email','acceptance-staff-'||replace(s::text,'-','')||'@example.test',false);
  perform set_config('request.jwt.claim.sub',c::text,true);
end $$;
set local role authenticated;

select ok(public.onboard_organization('Real Life Acceptance Co.') is not null,'owner can onboard organization');
select is((select count(*)::bigint from public.organization_users ou join public.organizations o on o.id=ou.organization_id where o.name='Real Life Acceptance Co.' and ou.is_active),1::bigint,'owner starts as sole active member');

insert into public.units_of_measure(organization_id,name) select id,'box' from public.organizations where name='Real Life Acceptance Co.';
insert into public.contacts(organization_id,name,phone,email,created_by) select id,'ACME Supplier','+8801700000000','supplier@acceptance.test',auth.uid() from public.organizations where name='Real Life Acceptance Co.';
insert into public.contacts(organization_id,name,phone,email,created_by) select id,'Retail Customer','+8801800000000','customer@acceptance.test',auth.uid() from public.organizations where name='Real Life Acceptance Co.';
insert into public.products(organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id,created_by)
select o.id,'Widget A',u.id,inv.id,rev.id,cogs.id,auth.uid() from public.organizations o
join public.units_of_measure u on u.organization_id=o.id and u.name='box'
join public.accounts inv on inv.organization_id=o.id and inv.account_code='1200'
join public.accounts rev on rev.organization_id=o.id and rev.account_code='4000'
join public.accounts cogs on cogs.organization_id=o.id and cogs.account_code='5000'
where o.name='Real Life Acceptance Co.';
select ok(exists(select 1 from public.products where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and name='Widget A'),'owner can configure product');

update public.organizations set city='Dhaka',country='Bangladesh',email='owner@acceptance.test' where name='Real Life Acceptance Co.';
select is((select city from public.organizations where name='Real Life Acceptance Co.'),'Dhaka','owner can maintain organization profile');

select ok(public.post_opening_setup(
 (select id from public.organizations where name='Real Life Acceptance Co.'),current_date,'Opening',
 jsonb_build_array(
  jsonb_build_object('account_id',(select id from public.accounts where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and account_code='1000'),'debit',5000,'credit',0),
  jsonb_build_object('account_id',(select id from public.accounts where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and account_code='1200'),'debit',500,'credit',0),
  jsonb_build_object('account_id',(select id from public.accounts where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and account_code='3000'),'debit',0,'credit',5500)),
 jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and name='Widget A'),'quantity',10,'unit_cost',50))
) is not null,'owner can initialize opening GL and stock');
select is((select quantity from public.inventory_balances ib join public.products p on p.id=ib.product_id where ib.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and p.name='Widget A'),10::numeric,'opening stock is available');
select is((select average_cost from public.inventory_balances ib join public.products p on p.id=ib.product_id where ib.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and p.name='Widget A'),50::numeric,'opening weighted-average cost is correct');

select is(public.add_organization_user_by_email((select id from public.organizations where name='Real Life Acceptance Co.'),current_setting('test.acceptance_staff_email')),current_setting('test.acceptance_staff')::uuid,'owner can invite staff');
select is((select count(*)::bigint from public.organization_users ou join public.organizations o on o.id=ou.organization_id where o.name='Real Life Acceptance Co.' and ou.is_active),2::bigint,'owner and staff are active members');
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('test.acceptance_staff'),true); end $$;
select is((select count(*)::bigint from public.organizations where name='Real Life Acceptance Co.'),1::bigint,'staff can see the organization');

insert into public.purchase(organization_id,supplier_id,invoice_date,subtotal,discount_amount,total_amount,payable_account_id,created_by)
select o.id,c.id,current_date,500,0,500,a.id,auth.uid() from public.organizations o join public.contacts c on c.organization_id=o.id and c.name='ACME Supplier' join public.accounts a on a.organization_id=o.id and a.account_code='2000' where o.name='Real Life Acceptance Co.';
insert into public.purchase_items(organization_id,purchase_id,line_number,product_id,quantity,unit_cost,line_total)
select p.organization_id,p.id,1,pr.id,5,100,500 from public.purchase p join public.products pr on pr.organization_id=p.organization_id and pr.name='Widget A' where p.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and p.status='DRAFT';
select public.confirm_purchase((select id from public.purchase where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and status='DRAFT'));
select is((select status from public.purchase where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and total_amount=500),'CONFIRMED'::public.document_status,'staff can confirm purchase');
select ok((select invoice_id from public.purchase where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and status='CONFIRMED') is not null,'purchase receives document number');
select is((select quantity from public.inventory_balances ib join public.products p on p.id=ib.product_id where ib.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and p.name='Widget A'),15::numeric,'purchase increases inventory');
select is((select average_cost from public.inventory_balances ib join public.products p on p.id=ib.product_id where ib.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and p.name='Widget A'),66.6667::numeric,'purchase recalculates weighted-average cost');

insert into public.sales(organization_id,customer_id,invoice_date,subtotal,discount_amount,total_amount,receivable_account_id,created_by)
select o.id,c.id,current_date,600,0,600,a.id,auth.uid() from public.organizations o join public.contacts c on c.organization_id=o.id and c.name='Retail Customer' join public.accounts a on a.organization_id=o.id and a.account_code='1100' where o.name='Real Life Acceptance Co.';
insert into public.sales_items(organization_id,sales_id,line_number,product_id,quantity,unit_price,line_total)
select s.organization_id,s.id,1,pr.id,3,200,600 from public.sales s join public.products pr on pr.organization_id=s.organization_id and pr.name='Widget A' where s.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and s.status='DRAFT';
select public.confirm_sales((select id from public.sales where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and status='DRAFT'));
select is((select status from public.sales where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and total_amount=600),'CONFIRMED'::public.document_status,'staff can confirm sale');
select ok((select invoice_id from public.sales where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and status='CONFIRMED') is not null,'sale receives document number');
select is((select quantity from public.inventory_balances ib join public.products p on p.id=ib.product_id where ib.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and p.name='Widget A'),12::numeric,'sale reduces inventory');
select is(round((select inventory_value from public.inventory_balances ib join public.products p on p.id=ib.product_id where ib.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and p.name='Widget A'),2),800::numeric,'sale leaves expected inventory value');
select is((select coalesce(sum(at.debit-at.credit),0) from public.account_transactions at join public.accounts a on a.id=at.account_id where at.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and a.account_code='1100'),600::numeric,'sale creates receivable');

insert into public.expenses(organization_id,expense_category_id,contact_id,payable_account_id,expense_date,amount,description,created_by)
select o.id,ec.id,c.id,a.id,current_date,100,'Utilities',auth.uid() from public.organizations o join public.expense_categories ec on ec.organization_id=o.id join public.contacts c on c.organization_id=o.id and c.name='ACME Supplier' join public.accounts a on a.organization_id=o.id and a.account_code='2000' where o.name='Real Life Acceptance Co.';
select public.confirm_expense((select id from public.expenses where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and status='DRAFT'));
select is((select status from public.expenses where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and amount=100),'CONFIRMED'::public.document_status,'staff can confirm expense');

insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id,settlement_account_id,created_by)
select o.id,'PAYMENT',c.id,current_date,600,ap.id,cash.id,auth.uid() from public.organizations o join public.contacts c on c.organization_id=o.id and c.name='ACME Supplier' join public.accounts ap on ap.organization_id=o.id and ap.account_code='2000' join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000' where o.name='Real Life Acceptance Co.';
insert into public.payment_allocations(organization_id,payment_id,document_type,document_id,allocated_amount)
select p.organization_id,p.id,'PURCHASE',pu.id,500 from public.payments p join public.purchase pu on pu.organization_id=p.organization_id and pu.status='CONFIRMED' where p.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and p.status='DRAFT' and p.payment_type='PAYMENT';
insert into public.payment_allocations(organization_id,payment_id,document_type,document_id,allocated_amount)
select p.organization_id,p.id,'EXPENSE',e.id,100 from public.payments p join public.expenses e on e.organization_id=p.organization_id and e.status='CONFIRMED' where p.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and p.status='DRAFT' and p.payment_type='PAYMENT';
select public.confirm_payment((select id from public.payments where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and status='DRAFT' and payment_type='PAYMENT'));
select is((select coalesce(sum(at.debit-at.credit),0) from public.account_transactions at join public.accounts a on a.id=at.account_id where at.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and a.account_code='2000'),0::numeric,'supplier liability is fully settled');

insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id,settlement_account_id,created_by)
select o.id,'RECEIPT',c.id,current_date,600,ar.id,cash.id,auth.uid() from public.organizations o join public.contacts c on c.organization_id=o.id and c.name='Retail Customer' join public.accounts ar on ar.organization_id=o.id and ar.account_code='1100' join public.accounts cash on cash.organization_id=o.id and cash.account_code='1000' where o.name='Real Life Acceptance Co.';
insert into public.payment_allocations(organization_id,payment_id,document_type,document_id,allocated_amount)
select p.organization_id,p.id,'SALES',s.id,600 from public.payments p join public.sales s on s.organization_id=p.organization_id and s.status='CONFIRMED' where p.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and p.status='DRAFT' and p.payment_type='RECEIPT';
select public.confirm_payment((select id from public.payments where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and status='DRAFT' and payment_type='RECEIPT'));
select is((select coalesce(sum(at.debit-at.credit),0) from public.account_transactions at join public.accounts a on a.id=at.account_id where at.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and a.account_code='1100'),0::numeric,'customer receivable is fully settled');
select is((select coalesce(sum(at.debit-at.credit),0) from public.account_transactions at join public.accounts a on a.id=at.account_id where at.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and a.account_code='1000'),5000::numeric,'cash reconciles to opening cash');
select ok((select count(*)::bigint from public.payments where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and status='CONFIRMED')=2,'supplier payment and customer receipt are posted');

insert into public.journal_entries(organization_id,accounting_period_id,entry_date,entry_type,status,description,created_by)
select o.id,ap.id,current_date,'ADJUSTMENT','DRAFT','Month-end adjustment',auth.uid() from public.organizations o join public.accounting_periods ap on ap.organization_id=o.id and ap.status='OPEN' where o.name='Real Life Acceptance Co.';
insert into public.account_transactions(organization_id,journal_entry_id,account_id,line_number,debit,credit,description)
select j.organization_id,j.id,cash.id,1,25,0,'Adjustment debit' from public.journal_entries j join public.accounts cash on cash.organization_id=j.organization_id and cash.account_code='1000' where j.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and j.entry_type='ADJUSTMENT' and j.status='DRAFT';
insert into public.account_transactions(organization_id,journal_entry_id,account_id,line_number,debit,credit,description)
select j.organization_id,j.id,equity.id,2,0,25,'Adjustment credit' from public.journal_entries j join public.accounts equity on equity.organization_id=j.organization_id and equity.account_code='3000' where j.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and j.entry_type='ADJUSTMENT' and j.status='DRAFT';
select public.confirm_journal_entry((select id from public.journal_entries where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and entry_type='ADJUSTMENT' and status='DRAFT'));
select ok(not exists(select 1 from public.journal_entries je where je.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and exists(select 1 from public.account_transactions at where at.organization_id=je.organization_id and at.journal_entry_id=je.id group by at.journal_entry_id having sum(at.debit)<>sum(at.credit))),'all generated journals are balanced');

select public.close_accounting_period((select id from public.accounting_periods where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and status='OPEN'));
select is((select count(*)::bigint from public.accounting_periods where organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and status='CLOSED'),1::bigint,'staff can close completed accounting period');

do $$ begin perform set_config('request.jwt.claim.sub',current_setting('test.acceptance_creator'),true); end $$;
select public.remove_organization_user((select id from public.organizations where name='Real Life Acceptance Co.'),current_setting('test.acceptance_staff')::uuid);
select is((select is_active from public.organization_users ou where ou.organization_id=(select id from public.organizations where name='Real Life Acceptance Co.') and ou.user_id=current_setting('test.acceptance_staff')::uuid),false,'owner can deactivate staff membership');

do $$ begin perform set_config('request.jwt.claim.sub',current_setting('test.acceptance_staff'),true); end $$;
select is((select count(*)::bigint from public.organizations where name='Real Life Acceptance Co.'),0::bigint,'deactivated staff loses tenant visibility');

select * from finish();
rollback;
