--
-- Row Level Security
-- Partners can only access rows owned by their sales record. Administrators
-- retain global visibility and perform commission mutations through RPCs.
--

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.deals enable row level security;
alter table public.deal_notes enable row level security;
alter table public.sales enable row level security;
alter table public.tags enable row level security;
alter table public.tasks enable row level security;
alter table public.commissions enable row level security;
alter table public.commission_events enable row level security;
alter table public.sales_commission_rate_history enable row level security;
alter table public.deal_ownership_events enable row level security;
alter table public.configuration enable row level security;
alter table public.favicons_excluded_domains enable row level security;

create policy "Companies select own or admin" on public.companies
  for select to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id());
create policy "Companies insert own or admin" on public.companies
  for insert to authenticated
  with check (public.is_admin() or sales_id = public.current_sales_id());
create policy "Companies update own or admin" on public.companies
  for update to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id())
  with check (public.is_admin() or sales_id = public.current_sales_id());
create policy "Companies delete admin" on public.companies
  for delete to authenticated using (public.is_admin());

create policy "Contacts select own or admin" on public.contacts
  for select to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id());
create policy "Contacts insert own or admin" on public.contacts
  for insert to authenticated
  with check (
    (public.is_admin() or sales_id = public.current_sales_id())
    and (company_id is null or exists (
      select 1 from public.companies c
      where c.id = company_id and (public.is_admin() or c.sales_id = public.current_sales_id())
    ))
  );
create policy "Contacts update own or admin" on public.contacts
  for update to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id())
  with check (
    (public.is_admin() or sales_id = public.current_sales_id())
    and (company_id is null or exists (
      select 1 from public.companies c
      where c.id = company_id and (public.is_admin() or c.sales_id = public.current_sales_id())
    ))
  );
create policy "Contacts delete admin" on public.contacts
  for delete to authenticated using (public.is_admin());

create policy "Contact notes select own or admin" on public.contact_notes
  for select to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id());
create policy "Contact notes insert own or admin" on public.contact_notes
  for insert to authenticated
  with check (
    (public.is_admin() or sales_id = public.current_sales_id())
    and exists (
      select 1 from public.contacts c
      where c.id = contact_id and (public.is_admin() or c.sales_id = public.current_sales_id())
    )
  );
create policy "Contact notes update own or admin" on public.contact_notes
  for update to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id())
  with check (public.is_admin() or sales_id = public.current_sales_id());
create policy "Contact notes delete admin" on public.contact_notes
  for delete to authenticated using (public.is_admin());

create policy "Deals select own or admin" on public.deals
  for select to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id());
create policy "Deals insert own or admin" on public.deals
  for insert to authenticated
  with check (
    (public.is_admin() or sales_id = public.current_sales_id())
    and (company_id is null or exists (
      select 1 from public.companies c
      where c.id = company_id and (public.is_admin() or c.sales_id = public.current_sales_id())
    ))
  );
create policy "Deals update own or admin" on public.deals
  for update to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id())
  with check (
    (public.is_admin() or sales_id = public.current_sales_id())
    and (company_id is null or exists (
      select 1 from public.companies c
      where c.id = company_id and (public.is_admin() or c.sales_id = public.current_sales_id())
    ))
  );
create policy "Deals delete admin" on public.deals
  for delete to authenticated using (public.is_admin());

create policy "Deal notes select own or admin" on public.deal_notes
  for select to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id());
create policy "Deal notes insert own or admin" on public.deal_notes
  for insert to authenticated
  with check (
    (public.is_admin() or sales_id = public.current_sales_id())
    and exists (
      select 1 from public.deals d
      where d.id = deal_id and (public.is_admin() or d.sales_id = public.current_sales_id())
    )
  );
create policy "Deal notes update own or admin" on public.deal_notes
  for update to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id())
  with check (public.is_admin() or sales_id = public.current_sales_id());
create policy "Deal notes delete admin" on public.deal_notes
  for delete to authenticated using (public.is_admin());

create policy "Sales select self or admin" on public.sales
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

create policy "Tags read authenticated" on public.tags
  for select to authenticated using (true);
create policy "Tags insert admin" on public.tags
  for insert to authenticated with check (public.is_admin());
create policy "Tags update admin" on public.tags
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Tags delete admin" on public.tags
  for delete to authenticated using (public.is_admin());

create policy "Tasks select own or admin" on public.tasks
  for select to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id());
create policy "Tasks insert own or admin" on public.tasks
  for insert to authenticated
  with check (
    (public.is_admin() or sales_id = public.current_sales_id())
    and exists (
      select 1 from public.contacts c
      where c.id = contact_id and (public.is_admin() or c.sales_id = public.current_sales_id())
    )
  );
create policy "Tasks update own or admin" on public.tasks
  for update to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id())
  with check (public.is_admin() or sales_id = public.current_sales_id());
create policy "Tasks delete admin" on public.tasks
  for delete to authenticated using (public.is_admin());

create policy "Commissions select own or admin" on public.commissions
  for select to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id());
create policy "Commission events select own or admin" on public.commission_events
  for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.commissions c
      where c.id = commission_id and c.sales_id = public.current_sales_id()
    )
  );
create policy "Rate history select self or admin" on public.sales_commission_rate_history
  for select to authenticated
  using (public.is_admin() or sales_id = public.current_sales_id());
create policy "Deal ownership events select own or admin" on public.deal_ownership_events
  for select to authenticated
  using (
    public.is_admin() or previous_sales_id = public.current_sales_id()
    or new_sales_id = public.current_sales_id()
  );

create policy "Configuration read authenticated" on public.configuration
  for select to authenticated using (true);
create policy "Configuration insert admin" on public.configuration
  for insert to authenticated with check (public.is_admin());
create policy "Configuration update admin" on public.configuration
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Favicons read authenticated" on public.favicons_excluded_domains
  for select to authenticated using (true);
create policy "Favicons write admin" on public.favicons_excluded_domains
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
