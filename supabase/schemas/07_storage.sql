--
-- Storage
-- Private CRM files are namespaced by sales id. Application branding remains
-- in a separate public bucket.
--

insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do update set public = excluded.public;

update storage.buckets set public = false where id = 'attachments';

create policy "CRM files select own or admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (
      public.is_admin()
      or exists (
        select 1 from public.attachment_namespaces namespace
        where namespace.namespace_sales_id::text = (storage.foldername(name))[1]
          and namespace.current_owner_sales_id = public.current_sales_id()
      )
      or (
        coalesce(array_length(storage.foldername(name), 1), 0) = 0
        and public.can_access_legacy_attachment(name)
      )
    )
  );
create policy "CRM files insert own or admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.current_sales_id()::text
    )
  );
create policy "CRM files update own or admin" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attachments'
    and (
      public.is_admin()
      or exists (
        select 1 from public.attachment_namespaces namespace
        where namespace.namespace_sales_id::text = (storage.foldername(name))[1]
          and namespace.current_owner_sales_id = public.current_sales_id()
      )
      or (
        coalesce(array_length(storage.foldername(name), 1), 0) = 0
        and public.can_access_legacy_attachment(name)
      )
    )
  );
create policy "CRM files delete own or admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (
      public.is_admin()
      or exists (
        select 1 from public.attachment_namespaces namespace
        where namespace.namespace_sales_id::text = (storage.foldername(name))[1]
          and namespace.current_owner_sales_id = public.current_sales_id()
      )
      or (
        coalesce(array_length(storage.foldername(name), 1), 0) = 0
        and public.can_access_legacy_attachment(name)
      )
    )
  );

create policy "Brand assets read" on storage.objects
  for select using (bucket_id = 'assets');
create policy "Brand assets write admin" on storage.objects
  for all to authenticated
  using (bucket_id = 'assets' and public.is_admin())
  with check (bucket_id = 'assets' and public.is_admin());
