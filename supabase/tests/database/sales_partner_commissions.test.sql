begin;

select plan(14);

select ok(
  has_table_privilege('authenticated', 'public.activity_log', 'SELECT'),
  'authenticated users can read the activity view'
);
select ok(
  has_table_privilege('authenticated', 'public.companies_summary', 'SELECT'),
  'authenticated users can read the company summary view'
);
select ok(
  has_table_privilege('authenticated', 'public.contacts_summary', 'SELECT'),
  'authenticated users can read the contact summary view'
);

select is(
  (select public from storage.buckets where id = 'attachments'),
  false,
  'CRM attachments bucket is private'
);
select is(
  (select public from storage.buckets where id = 'assets'),
  true,
  'branding assets use a separate public bucket'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'commission-admin@example.test', '', now(), '{}', '{"first_name":"Commission","last_name":"Admin"}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'commission-partner-a@example.test', '', now(), '{}', '{"first_name":"Partner","last_name":"A"}', now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'commission-partner-b@example.test', '', now(), '{}', '{"first_name":"Partner","last_name":"B"}', now(), now());

update public.sales
set administrator = true
where email = 'commission-admin@example.test';

select id as partner_a_id from public.sales where email = 'commission-partner-a@example.test' \gset
select id as partner_b_id from public.sales where email = 'commission-partner-b@example.test' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

insert into public.companies (name)
values ('Private Partner A Client') returning id as company_id \gset
insert into public.contacts (
  first_name, last_name, company_id, email_jsonb, phone_jsonb
) values (
  'Private', 'Contact', :company_id, '[]', '[]'
) returning id as contact_id \gset
insert into public.deals (
  name, company_id, contact_ids, category, stage, description, amount,
  expected_closing_date, index, client_type
) values (
  'Won Project', :company_id, array[:contact_id]::bigint[],
  'custom-software', 'won', 'Commission test', 100000,
  current_date, 0, 'new'
) returning id as deal_id \gset

select is(
  (select new_commission_rate_snapshot from public.deals where id = :deal_id),
  20.00::numeric,
  'new-client rate is snapshotted when the deal is created'
);

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is((select count(*) from public.companies), 0::bigint, 'other partner cannot see the company');
select is((select count(*) from public.contacts), 0::bigint, 'other partner cannot see the contact');
select is((select count(*) from public.deals), 0::bigint, 'other partner cannot see the deal');

select throws_ok(
  format(
    'select public.record_client_payment(%s, %L, %s, %s, now(), null, null)',
    :deal_id, 'new', 100000, 25000
  ),
  'P0001',
  'Only administrators can record client payments',
  'partner cannot create a commission directly'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select (public.record_client_payment(
  :deal_id, 'new', 100000, 25000, now(), 'PAYMENT-1', null
)).id as commission_id \gset

select is(
  (select commission_amount from public.commissions where id = :commission_id),
  20000.00::numeric,
  'commission uses the snapshotted rate and final invoice total'
);

select public.transition_commission(:commission_id, 'approved');
select public.transition_commission(
  :commission_id, 'paid', null, now(), 'PAYOUT-1', null
);
select is(
  (select status from public.commissions where id = :commission_id),
  'paid',
  'admin can approve and record payout'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is((select count(*) from public.commissions), 1::bigint, 'owner can see the commission');

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is((select count(*) from public.commissions), 0::bigint, 'other partner cannot see the commission');

select * from finish();
rollback;
