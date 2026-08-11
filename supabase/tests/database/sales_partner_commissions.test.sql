begin;

select plan(29);

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

select id as admin_id from public.sales where email = 'commission-admin@example.test' \gset
select id as partner_a_id from public.sales where email = 'commission-partner-a@example.test' \gset
select id as partner_b_id from public.sales where email = 'commission-partner-b@example.test' \gset

select ok(
  not has_function_privilege(
    'public',
    'public.record_client_payment(bigint,text,numeric,numeric,timestamp with time zone,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'public', 'public.transition_commission(bigint,text,date,timestamp with time zone,text,text)', 'EXECUTE'
  )
  and not has_function_privilege(
    'public', 'public.replace_commission(bigint,text,numeric,text)', 'EXECUTE'
  )
  and not has_function_privilege(
    'public', 'public.reassign_deal(bigint,bigint,text)', 'EXECUTE'
  ),
  'commission mutation RPCs are not executable through PUBLIC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.record_client_payment(bigint,text,numeric,numeric,timestamp with time zone,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated', 'public.transition_commission(bigint,text,date,timestamp with time zone,text,text)', 'EXECUTE'
  )
  and has_function_privilege(
    'authenticated', 'public.replace_commission(bigint,text,numeric,text)', 'EXECUTE'
  )
  and has_function_privilege(
    'authenticated', 'public.reassign_deal(bigint,bigint,text)', 'EXECUTE'
  ),
  'authenticated CRM users can invoke RLS-aware commission RPCs'
);
select ok(
  has_function_privilege(
    'service_role', 'public.update_sales_commission_rates(bigint,bigint,numeric,numeric)', 'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated', 'public.update_sales_commission_rates(bigint,bigint,numeric,numeric)', 'EXECUTE'
  ),
  'rate update RPC is restricted to the service role'
);

set local role service_role;
select public.update_sales_commission_rates(:partner_a_id, :admin_id, 25, 17.5);
select is(
  (select new_client_commission_rate from public.sales where id = :partner_a_id),
  25.00::numeric,
  'service role can update a partner rate through the audited RPC'
);
select is(
  (select count(*) from public.sales_commission_rate_history where sales_id = :partner_a_id),
  1::bigint,
  'rate update creates exactly one history record'
);
select public.update_sales_commission_rates(:partner_a_id, :admin_id, 25, 17.5);
select is(
  (select count(*) from public.sales_commission_rate_history where sales_id = :partner_a_id),
  1::bigint,
  'an unchanged rate does not create duplicate history'
);
select throws_ok(
  format(
    'select public.update_sales_commission_rates(%s, %s, 30, 18)',
    :partner_a_id, :partner_b_id
  ),
  'P0001',
  'Active administrator required',
  'rate update rejects a non-admin actor even through service role'
);

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
  25.00::numeric,
  'new-client rate is snapshotted when the deal is created'
);

insert into public.contact_notes (contact_id, text, attachments)
values (
  :contact_id,
  'Legacy attachment owner test',
  array['{"title":"legacy.pdf","path":"legacy.pdf","src":"https://example.test/attachments/legacy.pdf"}'::jsonb]
);
select ok(
  public.can_access_legacy_attachment('legacy.pdf'),
  'attachment owner can access a referenced legacy root object'
);

insert into public.deals (
  name, company_id, contact_ids, category, stage, description, amount,
  expected_closing_date, index, client_type
) values (
  'Reassignment Match Test', :company_id, array[:contact_id]::bigint[],
  'custom-software', 'new-lead', 'Contact matching test', 1000,
  current_date, 1, 'new'
) returning id as reassign_deal_id \gset

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is((select count(*) from public.companies), 0::bigint, 'other partner cannot see the company');
select is((select count(*) from public.contacts), 0::bigint, 'other partner cannot see the contact');
select is((select count(*) from public.deals), 0::bigint, 'other partner cannot see the deal');
select ok(
  not public.can_access_legacy_attachment('legacy.pdf'),
  'another partner cannot access an owner legacy attachment'
);

insert into public.companies (name)
values ('Unrelated Partner B Client') returning id as unrelated_company_id \gset
insert into public.contacts (
  first_name, last_name, company_id, email_jsonb, phone_jsonb
) values (
  'Private', 'Contact', :unrelated_company_id, '[]', '[]'
) returning id as misleading_contact_id \gset

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
select public.reassign_deal(:reassign_deal_id, :partner_b_id, 'Coverage for safe matching');
select isnt(
  (select contact_ids[1] from public.deals where id = :reassign_deal_id),
  :misleading_contact_id::bigint,
  'reassignment does not reuse a same-name contact from another company'
);
select throws_ok(
  format(
    'insert into public.deals (name, contact_ids, category, stage, amount, expected_closing_date, index, client_type, sales_id) values (%L, array[%s]::bigint[], %L, %L, 1, current_date, 2, %L, %s)',
    'Cross-owner contact', :contact_id, 'custom-software', 'new-lead', 'new', :partner_b_id
  ),
  'P0001',
  'All deal contacts must belong to the deal owner',
  'deal trigger rejects a contact owned by another partner'
);
select (public.record_client_payment(
  :deal_id, 'new', 100000, 25000, now(), 'PAYMENT-1', null
)).id as commission_id \gset

select is(
  (select commission_amount from public.commissions where id = :commission_id),
  25000.00::numeric,
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

reset role;
update public.sales
set disabled = true, administrator = true
where id = :partner_b_id;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is(public.current_sales_id(), null::bigint, 'disabled user has no active sales identity');
select is(public.is_admin(), false, 'disabled administrator is not treated as an admin');
select is((select count(*) from public.sales), 0::bigint, 'disabled user cannot read the sales table');
select is(
  (select count(*) from public.tags) + (select count(*) from public.configuration),
  0::bigint,
  'disabled user cannot read shared CRM configuration'
);

select * from finish();
rollback;
