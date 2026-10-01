begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

do $seed$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000101';
  v_org uuid; v_unit uuid; v_cash uuid; v_ar uuid; v_inventory uuid; v_ap uuid; v_equity uuid; v_sales uuid; v_cogs uuid; v_opex uuid;
  v_product uuid; v_contact uuid; v_period uuid; v_purchase uuid; v_purchase_item uuid; v_sale uuid; v_sale_item uuid; v_payment uuid;
  v_overpay uuid; v_return_purchase uuid; v_return_purchase_item uuid; v_return_sale uuid; v_return_sale_item uuid;
begin
  insert into auth.users(id,email) values(v_user,'erp-test-101@example.com');
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  insert into public.organizations(name,base_currency) values('ERP Functional Test','BDT') returning id into v_org;
  insert into public.units_of_measure(organization_id,name) values(v_org,'Pieces') returning id into v_unit;
  insert into public.accounting_periods(organization_id,name,start_date,end_date) values(v_org,'FY Test','2026-01-01','2026-12-31') returning id into v_period;

  insert into public.accounts(organization_id,account_code,account_name,account_type,normal_balance) values
    (v_org,'1000','Cash','asset','debit'),(v_org,'1100','Accounts Receivable','asset','debit'),
    (v_org,'1200','Inventory','asset','debit'),(v_org,'2000','Accounts Payable','liability','credit'),
    (v_org,'3000','Owner Equity','equity','credit'),(v_org,'4000','Sales Revenue','revenue','credit'),
    (v_org,'5000','Cost of Goods Sold','expense','debit'),(v_org,'5100','Operating Expense','expense','debit');

  select id into v_cash from public.accounts where organization_id=v_org and account_code='1000';
  select id into v_ar from public.accounts where organization_id=v_org and account_code='1100';
  select id into v_inventory from public.accounts where organization_id=v_org and account_code='1200';
  select id into v_ap from public.accounts where organization_id=v_org and account_code='2000';
  select id into v_equity from public.accounts where organization_id=v_org and account_code='3000';
  select id into v_sales from public.accounts where organization_id=v_org and account_code='4000';
  select id into v_cogs from public.accounts where organization_id=v_org and account_code='5000';
  select id into v_opex from public.accounts where organization_id=v_org and account_code='5100';

  insert into public.expense_categories(organization_id,category_code,name,expense_account_id) values(v_org,'OFFICE','Office Expense',v_opex);
  insert into public.contacts(organization_id,name) values(v_org,'Test Trading Partner') returning id into v_contact;
  insert into public.products(organization_id,name,unit_id,inventory_account_id,sales_account_id,cogs_account_id)
  values(v_org,'Test Product',v_unit,v_inventory,v_sales,v_cogs) returning id into v_product;

  insert into public.purchase_invoices(organization_id,document_type,supplier_id,invoice_date,subtotal,discount_amount,total_amount)
  values(v_org,'purchase',v_contact,'2026-09-01',100,20,80) returning id into v_purchase;
  insert into public.purchase_items(organization_id,purchase_invoice_id,line_number,product_id,quantity,unit_cost,discount_per_unit,net_unit_cost,line_total)
  values(v_org,v_purchase,1,v_product,10,10,2,8,80) returning id into v_purchase_item;

  insert into public.sales_invoices(organization_id,document_type,customer_id,invoice_date,subtotal,discount_amount,total_amount)
  values(v_org,'sale',v_contact,'2026-09-02',80,8,72) returning id into v_sale;
  insert into public.sales_items(organization_id,sales_invoice_id,line_number,product_id,quantity,unit_price,discount_per_unit,net_unit_price,line_total)
  values(v_org,v_sale,1,v_product,4,20,2,18,72) returning id into v_sale_item;

  insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id)
  values(v_org,'payment',v_contact,'2026-09-03',80,v_cash) returning id into v_payment;

  insert into public.purchase_invoices(organization_id,document_type,original_invoice_id,supplier_id,invoice_date,subtotal,discount_amount,total_amount)
  values(v_org,'return',v_purchase,v_contact,'2026-09-04',16,0,16) returning id into v_return_purchase;
  insert into public.purchase_items(organization_id,purchase_invoice_id,line_number,product_id,original_item_id,quantity,unit_cost,discount_per_unit,net_unit_cost,line_total)
  values(v_org,v_return_purchase,1,v_product,v_purchase_item,2,8,0,8,16) returning id into v_return_purchase_item;

  insert into public.sales_invoices(organization_id,document_type,original_invoice_id,customer_id,invoice_date,subtotal,discount_amount,total_amount)
  values(v_org,'return',v_sale,v_contact,'2026-09-05',18,0,18) returning id into v_return_sale;
  insert into public.sales_items(organization_id,sales_invoice_id,line_number,product_id,original_item_id,quantity,unit_price,discount_per_unit,net_unit_price,line_total,cogs_unit_cost,cogs_total)
  values(v_org,v_return_sale,1,v_product,v_sale_item,1,18,0,18,18,8,8) returning id into v_return_sale_item;

  perform public.post_purchase_invoice(v_purchase,v_ap);
  perform public.post_sales_invoice(v_sale,v_ar);
  perform public.post_payment(v_payment,v_ap,jsonb_build_array(jsonb_build_object('document_type','purchase','document_id',v_purchase,'allocated_amount',80)));

  insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id)
  values(v_org,'receipt',v_contact,'2026-09-03',72,v_cash) returning id into v_payment;
  perform public.post_payment(v_payment,v_ar,jsonb_build_array(jsonb_build_object('document_type','sale','document_id',v_sale,'allocated_amount',72)));

  insert into public.expenses(organization_id,expense_category_id,contact_id,expense_date,amount,description)
  select v_org,id,v_contact,'2026-09-03',30,'Office expense' from public.expense_categories where organization_id=v_org and category_code='OFFICE';
  perform public.post_expense((select id from public.expenses where organization_id=v_org and expense_number like 'EXP-%'),v_ap);

  insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id)
  values(v_org,'payment',v_contact,'2026-09-03',30,v_cash) returning id into v_payment;
  perform public.post_payment(v_payment,v_ap,jsonb_build_array(jsonb_build_object('document_type','expense','document_id',(select id from public.expenses where organization_id=v_org and expense_number like 'EXP-%'),'allocated_amount',30)));

  perform public.post_purchase_invoice(v_return_purchase,v_ap);
  insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id)
  values(v_org,'refund_in',v_contact,'2026-09-06',16,v_cash) returning id into v_payment;
  perform public.post_payment(v_payment,v_ap,jsonb_build_array(jsonb_build_object('document_type','purchase_return','document_id',v_return_purchase,'allocated_amount',16)));

  perform public.post_sales_invoice(v_return_sale,v_ar);
  insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id)
  values(v_org,'refund_out',v_contact,'2026-09-06',18,v_cash) returning id into v_payment;
  perform public.post_payment(v_payment,v_ar,jsonb_build_array(jsonb_build_object('document_type','sale_return','document_id',v_return_sale,'allocated_amount',18)));

  perform set_config('erp.test.org',v_org::text,true);
  perform set_config('erp.test.product',v_product::text,true);
  perform set_config('erp.test.sale',v_sale::text,true);
  perform set_config('erp.test.purchase',v_purchase::text,true);
end;
$seed$;

select is((select count(*) from public.purchase_invoices where status='posted'),2::bigint,'purchase and purchase return are posted');
select is((select count(*) from public.sales_invoices where status='posted'),2::bigint,'sale and sales return are posted');
select is((select quantity from public.inventory_balances where organization_id=current_setting('erp.test.org')::uuid and product_id=current_setting('erp.test.product')::uuid),5::numeric,'final inventory quantity is 5');
select is((select inventory_value from public.inventory_balances where organization_id=current_setting('erp.test.org')::uuid and product_id=current_setting('erp.test.product')::uuid),40::numeric,'final inventory value is 40');
select is((select average_cost from public.inventory_balances where organization_id=current_setting('erp.test.org')::uuid and product_id=current_setting('erp.test.product')::uuid),8::numeric,'final WAC is 8');
select is((select coalesce(sum(case when direction='in' then quantity else -quantity end),0) from public.inventory_transactions where organization_id=current_setting('erp.test.org')::uuid and product_id=current_setting('erp.test.product')::uuid),5::numeric,'inventory ledger quantity reconciles to balance');
select is((select coalesce(sum(case when direction='in' then total_value else -total_value end),0) from public.inventory_transactions where organization_id=current_setting('erp.test.org')::uuid and product_id=current_setting('erp.test.product')::uuid),40::numeric,'inventory ledger value reconciles to balance');
select is((select round(coalesce(sum(debit-credit),0),8) from public.account_transactions at join public.accounts a on a.id=at.account_id and a.organization_id=at.organization_id where at.organization_id=current_setting('erp.test.org')::uuid and a.account_code='1200'),40::numeric,'accounting inventory asset reconciles to inventory value');
select is((select round(coalesce(sum(debit-credit),0),8) from public.account_transactions at join public.accounts a on a.id=at.account_id and a.organization_id=at.organization_id where at.organization_id=current_setting('erp.test.org')::uuid and a.account_code='1100'),0::numeric,'accounts receivable is fully settled after sale return refund');
select is((select round(coalesce(sum(debit-credit),0),8) from public.account_transactions at join public.accounts a on a.id=at.account_id and a.organization_id=at.organization_id where at.organization_id=current_setting('erp.test.org')::uuid and a.account_code='2000'),0::numeric,'accounts payable is fully settled after purchase return refund');
select is((select round(coalesce(sum(debit-credit),0),8) from public.account_transactions at join public.accounts a on a.id=at.account_id and a.organization_id=at.organization_id where at.organization_id=current_setting('erp.test.org')::uuid and a.account_code='1000'),-40::numeric,'cash net movement reconciles to all payments, refunds and expense settlement');
select is((select round(coalesce(sum(debit-credit),0),8) from public.account_transactions at join public.accounts a on a.id=at.account_id and a.organization_id=at.organization_id where at.organization_id=current_setting('erp.test.org')::uuid and a.account_code='4000'),-54::numeric,'net revenue is 54 credit after sales return');
select is((select round(coalesce(sum(debit-credit),0),8) from public.account_transactions at join public.accounts a on a.id=at.account_id and a.organization_id=at.organization_id where at.organization_id=current_setting('erp.test.org')::uuid and a.account_code='5000'),24::numeric,'net COGS is 24 after sales return');
select is((select round(coalesce(sum(debit-credit),0),8) from public.account_transactions at join public.accounts a on a.id=at.account_id and a.organization_id=at.organization_id where at.organization_id=current_setting('erp.test.org')::uuid and a.account_code='5100'),30::numeric,'operating expense is 30');
select is((select count(*) from (select journal_entry_id from public.account_transactions where organization_id=current_setting('erp.test.org')::uuid group by journal_entry_id having round(sum(debit),8)<>round(sum(credit),8)) q),0::bigint,'all functional-test journals are balanced');
select is((select count(*) from public.payment_allocations pa join public.payments p on p.id=pa.payment_id where pa.organization_id=current_setting('erp.test.org')::uuid and p.status='posted'),5::bigint,'all five settlement/refund allocations are posted');
select throws_ok($pgtap$ update public.sales_invoices set status='posted' where id=current_setting('erp.test.sale')::uuid $pgtap$,'P0001','posted documents cannot be modified');
select is(has_table_privilege('authenticated','public.number_sequences','UPDATE'),false,'authenticated cannot directly modify sequence counters');
select throws_ok($pgtap$ delete from public.organization_users where organization_id=current_setting('erp.test.org')::uuid and role='owner' and is_active $pgtap$,'P0001','organization must retain an active owner');
select is((select count(*) from public.inventory_transactions where organization_id=current_setting('erp.test.org')::uuid),4::bigint,'inventory ledger contains purchase, sale, purchase return and sales return movements');
select is((select count(*) from public.journal_entries where organization_id=current_setting('erp.test.org')::uuid and status='posted'),10::bigint,'ten operational journals were posted');
select is((select count(*) from public.account_transactions where organization_id=current_setting('erp.test.org')::uuid),24::bigint,'journal line count matches the complete scenario');
select is((select count(*) from public.payment_allocations where organization_id=current_setting('erp.test.org')::uuid and allocated_amount<=0),0::bigint,'no invalid zero/negative allocations exist');

do $test$
declare v_overpay uuid;
begin
  insert into public.payments(organization_id,payment_type,contact_id,payment_date,amount,account_id)
  values(current_setting('erp.test.org')::uuid,'payment',(select contact_id from public.payments where organization_id=current_setting('erp.test.org')::uuid limit 1),'2026-09-07',100,(select id from public.accounts where organization_id=current_setting('erp.test.org')::uuid and account_code='1000'))
  returning id into v_overpay;
  perform set_config('erp.test.overpay',v_overpay::text,true);
  perform public.post_payment(v_overpay,(select id from public.accounts where organization_id=current_setting('erp.test.org')::uuid and account_code='2000'),'[]'::jsonb);
end;
$test$;

select throws_ok($$ insert into public.payment_allocations(organization_id,payment_id,document_type,document_id,allocated_amount) select current_setting('erp.test.org')::uuid,current_setting('erp.test.overpay')::uuid,'purchase',current_setting('erp.test.purchase')::uuid,81 $$,'P0001','document allocations exceed document amount');
select throws_ok($pgtap$ select public.reverse_journal((select posted_journal_entry_id from public.sales_invoices where id=current_setting('erp.test.sale')::uuid),'2026-09-10') $pgtap$,'P0001','operational journals must be corrected by their document workflow, not direct journal reversal');
select throws_ok($pgtap$ update public.accounting_periods set start_date='2025-01-01' where id=(select accounting_period_id from public.journal_entries where organization_id=current_setting('erp.test.org')::uuid and status='posted' limit 1) $pgtap$,'P0001','period with posted journals cannot change');
select is((select round(sum(debit),8)-round(sum(credit),8) from public.account_transactions where organization_id=current_setting('erp.test.org')::uuid),0::numeric,'complete trial balance is zero');

select * from finish();
rollback;