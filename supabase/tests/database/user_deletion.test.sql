begin;

select plan(25);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delete-admin@example.test', '', now(), '{}', '{"first_name":"Delete","last_name":"Admin"}', now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delete-source@example.test', '', now(), '{}', '{"first_name":"Delete","last_name":"Source"}', now(), now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delete-target@example.test', '', now(), '{}', '{"first_name":"Delete","last_name":"Target"}', now(), now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delete-unused@example.test', '', now(), '{}', '{"first_name":"Delete","last_name":"Unused"}', now(), now());

update public.sales set administrator = true where email = 'delete-admin@example.test';

select id as admin_id from public.sales where email = 'delete-admin@example.test' \gset
select id as source_id from public.sales where email = 'delete-source@example.test' \gset
select id as target_id from public.sales where email = 'delete-target@example.test' \gset
select id as unused_id from public.sales where email = 'delete-unused@example.test' \gset

select ok(
  has_function_privilege(
    'service_role',
    'public.prepare_sales_user_deletion(bigint,bigint,bigint,text)',
    'EXECUTE'
  ),
  'service role can invoke the deletion preparation RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.prepare_sales_user_deletion(bigint,bigint,bigint,text)',
    'EXECUTE'
  ),
  'authenticated browser users cannot invoke deletion preparation directly'
);
select is(
  (select count(*) from public.sales_identities where id in (:admin_id, :source_id, :target_id, :unused_id)),
  4::bigint,
  'sales identity snapshots are created for every account'
);
select is(
  (select count(*) from public.attachment_namespaces where namespace_sales_id in (:admin_id, :source_id, :target_id, :unused_id)),
  4::bigint,
  'attachment namespaces are created for every account'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);

insert into public.companies (name)
values ('Deletion Client') returning id as company_id \gset
insert into public.contacts (
  first_name, last_name, company_id, email_jsonb, phone_jsonb
) values (
  'Deletion', 'Contact', :company_id, '[]', '[]'
) returning id as contact_id \gset
insert into public.contact_notes (contact_id, text)
values (:contact_id, 'Historical contact note') returning id as contact_note_id \gset
insert into public.tasks (contact_id, type, text, due_date)
values (:contact_id, 'Call', 'Deletion transfer task', now()) returning id as task_id \gset
insert into public.deals (
  name, company_id, contact_ids, category, stage, amount, index, client_type
) values (
  'Pending deletion deal', :company_id, array[:contact_id]::bigint[], 'other', 'opportunity', 1000, 1, 'new'
) returning id as pending_deal_id \gset
insert into public.deals (
  name, company_id, contact_ids, category, stage, amount, index, client_type
) values (
  'Paid deletion deal', :company_id, array[:contact_id]::bigint[], 'other', 'won', 2000, 2, 'new'
) returning id as paid_deal_id \gset
insert into public.deal_notes (deal_id, text)
values (:pending_deal_id, 'Historical deal note') returning id as deal_note_id \gset

reset role;
insert into public.commissions (
  deal_id, sales_id, confirmed_client_type, final_invoice_total, applied_rate,
  commission_amount, first_payment_amount, first_payment_received_at, status,
  created_by
) values
  (:pending_deal_id, :source_id, 'new', 1000, 20, 200, 100, now(), 'pending_review', :admin_id),
  (:paid_deal_id, :source_id, 'new', 2000, 20, 400, 200, now(), 'paid', :admin_id);

insert into storage.objects (bucket_id, name, owner, owner_id)
values (
  'assets',
  'deletion-owner-test.txt',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);

select throws_ok(
  $$delete from auth.users where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  'P0001',
  'This user owns CRM data. Delete them through Xenora CRM to transfer it safely',
  'direct Auth deletion is blocked for a data-bearing user'
);

set local role service_role;
select throws_ok(
  format(
    'select public.prepare_sales_user_deletion(%s, %s, %s, %L)',
    :admin_id, :target_id, :admin_id, 'delete-admin@example.test'
  ),
  'P0001',
  'Administrators cannot delete their own account',
  'administrators cannot delete themselves'
);
select throws_ok(
  format(
    'select public.prepare_sales_user_deletion(%s, %s, %s, %L)',
    :source_id, :target_id, :admin_id, 'wrong@example.test'
  ),
  'P0001',
  'Confirmation email does not match',
  'the typed confirmation email must match'
);

select public.prepare_sales_user_deletion(
  :source_id, :target_id, :admin_id, 'DELETE-SOURCE@example.test'
) as prepared \gset

select ok(
  (select disabled and deletion_pending_at is not null from public.sales where id = :source_id),
  'the source account is disabled and marked deletion-pending'
);
select is((select sales_id from public.companies where id = :company_id), :target_id::bigint, 'company ownership transfers');
select is((select sales_id from public.contacts where id = :contact_id), :target_id::bigint, 'contact ownership transfers');
select is((select sales_id from public.deals where id = :pending_deal_id), :target_id::bigint, 'deal ownership transfers');
select ok(
  (select sales_id = :target_id from public.contact_notes where id = :contact_note_id)
  and (select sales_id = :target_id from public.deal_notes where id = :deal_note_id)
  and (select sales_id = :target_id from public.tasks where id = :task_id),
  'note and task ownership transfers'
);
select is(
  (select sales_id from public.commissions where deal_id = :pending_deal_id),
  :target_id::bigint,
  'pending-review commission transfers'
);
select is(
  (select sales_id from public.commissions where deal_id = :paid_deal_id),
  :source_id::bigint,
  'paid commission remains attributed to the source identity'
);
select is(
  (select created_by_sales_id from public.companies where id = :company_id),
  :source_id::bigint,
  'creator attribution is preserved'
);
select ok(
  (
    select owner = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      and owner_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    from storage.objects
    where bucket_id = 'assets' and name = 'deletion-owner-test.txt'
  ),
  'storage object ownership transfers transactionally'
);
select is(
  (select sales_id from public.activity_log where id = 'company.' || :company_id || '.created'),
  :source_id::bigint,
  'activity history resolves to the original creator'
);
select is(
  (select status from public.user_deletion_events where source_sales_id = :source_id),
  'prepared',
  'a prepared deletion audit event is recorded'
);
select is(
  (public.prepare_sales_user_deletion(
    :source_id, :target_id, :admin_id, 'delete-source@example.test'
  ) ->> 'event_id')::bigint,
  (select id from public.user_deletion_events where source_sales_id = :source_id),
  'deletion preparation is idempotent'
);

reset role;
delete from auth.users where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is((select count(*) from public.sales where id = :source_id), 0::bigint, 'Auth deletion removes the active salesperson row');
select ok((select deleted_at is not null from public.sales_identities where id = :source_id), 'the deleted identity snapshot remains');

set local role service_role;
select public.finalize_sales_user_deletion(
  (select id from public.user_deletion_events where source_sales_id = :source_id)
);
select is(
  (select status from public.user_deletion_events where source_sales_id = :source_id),
  'completed',
  'the deletion audit event can be finalized'
);

reset role;
delete from auth.users where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
select is((select count(*) from public.sales where id = :unused_id), 0::bigint, 'an unused non-admin can be deleted directly');
select ok((select deleted_at is not null from public.sales_identities where id = :unused_id), 'direct deletion preserves its identity snapshot');

select throws_ok(
  $$delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'P0001',
  'Administrators must be deleted through Xenora CRM',
  'administrators cannot be deleted directly from the Dashboard'
);

select * from finish();
rollback;
