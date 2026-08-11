drop trigger if exists "30_validate_deal_contacts_owner" on "public"."deals";

drop trigger if exists "validate_deal_contacts_owner" on "public"."deals";

drop policy if exists "Configuration read authenticated" on "public"."configuration";

drop policy if exists "Favicons read authenticated" on "public"."favicons_excluded_domains";

drop policy if exists "Sales select self or admin" on "public"."sales";

drop policy if exists "Tags read authenticated" on "public"."tags";

set check_function_bodies = off;

-- Older note records only stored a temporary public/signed URL. Recover the
-- object path without dropping unrelated elements from mixed attachment arrays.
update public.contact_notes note
set attachments = rebuilt.attachments
from (
  select n.id,
    array_agg(
      case
        when attachment ? 'path'
          or coalesce(attachment ->> 'src', '') !~ '/attachments/'
          then attachment
        else jsonb_set(
          attachment,
          '{path}',
          to_jsonb(regexp_replace(split_part(attachment ->> 'src', '?', 1), '^.*/attachments/', ''))
        )
      end
      order by ordinal
    ) as attachments
  from public.contact_notes n
  cross join lateral unnest(n.attachments) with ordinality as item(attachment, ordinal)
  group by n.id
  having bool_or(
    not (attachment ? 'path')
    and coalesce(attachment ->> 'src', '') ~ '/attachments/'
  )
) rebuilt
where note.id = rebuilt.id;

update public.deal_notes note
set attachments = rebuilt.attachments
from (
  select n.id,
    array_agg(
      case
        when attachment ? 'path'
          or coalesce(attachment ->> 'src', '') !~ '/attachments/'
          then attachment
        else jsonb_set(
          attachment,
          '{path}',
          to_jsonb(regexp_replace(split_part(attachment ->> 'src', '?', 1), '^.*/attachments/', ''))
        )
      end
      order by ordinal
    ) as attachments
  from public.deal_notes n
  cross join lateral unnest(n.attachments) with ordinality as item(attachment, ordinal)
  group by n.id
  having bool_or(
    not (attachment ? 'path')
    and coalesce(attachment ->> 'src', '') ~ '/attachments/'
  )
) rebuilt
where note.id = rebuilt.id;

CREATE OR REPLACE FUNCTION public.can_access_legacy_attachment(object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.is_admin() or exists (
    select 1
    from (
      select n.sales_id, unnest(n.attachments) as attachment
      from public.contact_notes n
      union all
      select n.sales_id, unnest(n.attachments) as attachment
      from public.deal_notes n
    ) note_attachment
    where note_attachment.sales_id = public.current_sales_id()
      and note_attachment.attachment ->> 'path' = object_name
  );
$function$
;

CREATE OR REPLACE FUNCTION public.reassign_deal(deal_id bigint, new_sales_id bigint, reason text)
 RETURNS public.deals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare
  actor_id bigint;
  deal_record public.deals%rowtype;
  new_partner public.sales%rowtype;
  updated_deal public.deals%rowtype;
  source_company public.companies%rowtype;
  target_company_id bigint;
  source_contact public.contacts%rowtype;
  source_contact_id bigint;
  target_contact_id bigint;
  target_contact_ids bigint[] := array[]::bigint[];
begin
  if not public.is_admin() then
    raise exception 'Only administrators can reassign deals';
  end if;
  if nullif(reason, '') is null then
    raise exception 'A reassignment reason is required';
  end if;
  actor_id := public.current_sales_id();
  select * into deal_record from public.deals where id = deal_id for update;
  select * into new_partner from public.sales where id = new_sales_id and disabled = false;
  if deal_record.id is null or new_partner.id is null then
    raise exception 'Deal or active partner not found';
  end if;
  if exists (
    select 1 from public.commissions c
    where c.deal_id = deal_record.id and c.status in ('approved', 'scheduled', 'paid')
  ) then
    raise exception 'Reverse the approved commission before reassigning this deal';
  end if;

  if deal_record.company_id is not null then
    select * into source_company from public.companies where id = deal_record.company_id;
    select id into target_company_id
      from public.companies
      where sales_id = new_partner.id
        and (
          (source_company.website is not null and website = source_company.website)
          or lower(name) = lower(source_company.name)
        )
      order by id limit 1;
    if target_company_id is null then
      insert into public.companies (
        name, sector, size, linkedin_url, website, phone_number, address,
        zipcode, city, state_abbr, sales_id, context_links, country,
        description, revenue, tax_identifier
      ) values (
        source_company.name, source_company.sector, source_company.size,
        source_company.linkedin_url, source_company.website,
        source_company.phone_number, source_company.address,
        source_company.zipcode, source_company.city, source_company.state_abbr,
        new_partner.id, source_company.context_links, source_company.country,
        source_company.description, source_company.revenue,
        source_company.tax_identifier
      ) returning id into target_company_id;
    end if;
  end if;

  foreach source_contact_id in array coalesce(deal_record.contact_ids, array[]::bigint[])
  loop
    select * into source_contact from public.contacts where id = source_contact_id;
    if source_contact.id is not null then
      -- Reuse a matching contact already owned by the new partner so repeated
      -- reassignment preserves activity history and avoids duplicates; only
      -- clone the source contact when no target-owned match exists.
      target_contact_id := null;
      select c.id into target_contact_id
        from public.contacts c
        where c.sales_id = new_partner.id
          and (
            (
              coalesce(jsonb_array_length(source_contact.email_jsonb), 0) > 0
              and coalesce(jsonb_array_length(c.email_jsonb), 0) > 0
              and exists (
                select 1
                from jsonb_array_elements(source_contact.email_jsonb) source_email
                join jsonb_array_elements(c.email_jsonb) target_email
                  on nullif(lower(btrim(target_email.value ->> 'email')), '')
                    = nullif(lower(btrim(source_email.value ->> 'email')), '')
              )
            )
            or (
              nullif(lower(btrim(c.linkedin_url)), '')
                = nullif(lower(btrim(source_contact.linkedin_url)), '')
            )
            or (
              lower(btrim(c.first_name)) = lower(btrim(source_contact.first_name))
              and lower(btrim(c.last_name)) = lower(btrim(source_contact.last_name))
              and coalesce(jsonb_array_length(source_contact.phone_jsonb), 0) > 0
              and coalesce(jsonb_array_length(c.phone_jsonb), 0) > 0
              and exists (
                select 1
                from jsonb_array_elements(source_contact.phone_jsonb) source_phone
                join jsonb_array_elements(c.phone_jsonb) target_phone
                  on regexp_replace(target_phone.value ->> 'number', '\\D', '', 'g')
                    = regexp_replace(source_phone.value ->> 'number', '\\D', '', 'g')
                where regexp_replace(source_phone.value ->> 'number', '\\D', '', 'g') <> ''
              )
            )
            or (
              coalesce(jsonb_array_length(source_contact.email_jsonb), 0) = 0
              and nullif(btrim(source_contact.linkedin_url), '') is null
              and coalesce(jsonb_array_length(source_contact.phone_jsonb), 0) = 0
              and lower(btrim(c.first_name)) = lower(btrim(source_contact.first_name))
              and lower(btrim(c.last_name)) = lower(btrim(source_contact.last_name))
              and c.company_id is not distinct from target_company_id
              and 1 = (
                select count(*)
                from public.contacts candidate
                where candidate.sales_id = new_partner.id
                  and lower(btrim(candidate.first_name)) = lower(btrim(source_contact.first_name))
                  and lower(btrim(candidate.last_name)) = lower(btrim(source_contact.last_name))
                  and candidate.company_id is not distinct from target_company_id
              )
            )
          )
        order by
          case
            when nullif(lower(btrim(c.linkedin_url)), '')
              = nullif(lower(btrim(source_contact.linkedin_url)), '') then 1
            else 2
          end,
          c.id
        limit 1;
      if target_contact_id is null then
        insert into public.contacts (
          first_name, last_name, gender, title, background, first_seen,
          last_seen, has_newsletter, status, tags, company_id, sales_id,
          linkedin_url, email_jsonb, phone_jsonb
        ) values (
          source_contact.first_name, source_contact.last_name,
          source_contact.gender, source_contact.title, source_contact.background,
          source_contact.first_seen, source_contact.last_seen,
          source_contact.has_newsletter, source_contact.status,
          source_contact.tags, target_company_id, new_partner.id,
          source_contact.linkedin_url, source_contact.email_jsonb,
          source_contact.phone_jsonb
        ) returning id into target_contact_id;
      end if;
      target_contact_ids := array_append(target_contact_ids, target_contact_id);
    end if;
  end loop;

  update public.deals set
    sales_id = new_partner.id,
    company_id = target_company_id,
    contact_ids = target_contact_ids,
    new_commission_rate_snapshot = new_partner.new_client_commission_rate,
    recurring_commission_rate_snapshot = new_partner.recurring_client_commission_rate,
    updated_at = now()
  where id = deal_record.id returning * into updated_deal;

  update public.deal_notes set sales_id = new_partner.id where deal_notes.deal_id = deal_record.id;
  update public.commissions c set
    sales_id = new_partner.id,
    applied_rate = case c.confirmed_client_type
      when 'new' then new_partner.new_client_commission_rate
      else new_partner.recurring_client_commission_rate
    end,
    commission_amount = round(c.final_invoice_total * (
      case c.confirmed_client_type
        when 'new' then new_partner.new_client_commission_rate
        else new_partner.recurring_client_commission_rate
      end
    ) / 100, 2),
    updated_at = now()
  where c.deal_id = deal_record.id and c.status = 'pending_review';

  insert into public.deal_ownership_events (
    deal_id, previous_sales_id, new_sales_id, actor_sales_id, reason
  ) values (
    deal_record.id, deal_record.sales_id, new_partner.id, actor_id, reason
  );
  return updated_deal;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_sales_id_default()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.sales_id IS NULL THEN
    NEW.sales_id := public.current_sales_id();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_sales_commission_rates(p_sales_id bigint, p_actor_sales_id bigint, p_new_new_rate numeric, p_new_recurring_rate numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare
  actor_record public.sales%rowtype;
  previous_record public.sales%rowtype;
begin
  if p_new_new_rate < 0 or p_new_new_rate > 100
    or p_new_recurring_rate < 0 or p_new_recurring_rate > 100 then
    raise exception 'Commission rates must be between 0 and 100';
  end if;

  select * into actor_record
    from public.sales
    where id = p_actor_sales_id and administrator = true and disabled = false;
  if actor_record.id is null then
    raise exception 'Active administrator required';
  end if;

  select * into previous_record from public.sales where id = p_sales_id for update;
  if previous_record.id is null then
    raise exception 'Sales partner not found';
  end if;

  if previous_record.new_client_commission_rate = p_new_new_rate
    and previous_record.recurring_client_commission_rate = p_new_recurring_rate then
    return;
  end if;

  update public.sales set
    new_client_commission_rate = p_new_new_rate,
    recurring_client_commission_rate = p_new_recurring_rate
  where id = p_sales_id;

  insert into public.sales_commission_rate_history (
    sales_id, actor_sales_id,
    previous_new_rate, new_new_rate,
    previous_recurring_rate, new_recurring_rate
  ) values (
    p_sales_id, p_actor_sales_id,
    previous_record.new_client_commission_rate, p_new_new_rate,
    previous_record.recurring_client_commission_rate, p_new_recurring_rate
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_deal_contacts_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.contact_ids is not null and exists (
    select 1
    from unnest(new.contact_ids) contact_id
    left join public.contacts c on c.id = contact_id
    where c.id is null or c.sales_id is distinct from new.sales_id
  ) then
    raise exception 'All deal contacts must belong to the deal owner';
  end if;
  return new;
end;
$function$
;


  create policy "Configuration read authenticated"
  on "public"."configuration"
  as permissive
  for select
  to authenticated
using ((public.current_sales_id() IS NOT NULL));



  create policy "Favicons read authenticated"
  on "public"."favicons_excluded_domains"
  as permissive
  for select
  to authenticated
using ((public.current_sales_id() IS NOT NULL));



  create policy "Sales select self or admin"
  on "public"."sales"
  as permissive
  for select
  to authenticated
using (((public.current_sales_id() IS NOT NULL) AND (public.is_admin() OR (user_id = auth.uid()))));



  create policy "Tags read authenticated"
  on "public"."tags"
  as permissive
  for select
  to authenticated
using ((public.current_sales_id() IS NOT NULL));


CREATE TRIGGER validate_deal_contacts_owner BEFORE INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.validate_deal_contacts_owner();

drop policy if exists "CRM files delete own or admin" on "storage"."objects";

drop policy if exists "CRM files select own or admin" on "storage"."objects";

drop policy if exists "CRM files update own or admin" on "storage"."objects";


  create policy "CRM files delete own or admin"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'attachments'::text) AND (public.is_admin() OR ((storage.foldername(name))[1] = (public.current_sales_id())::text) OR ((COALESCE(array_length(storage.foldername(name), 1), 0) = 0) AND public.can_access_legacy_attachment(name)))));

revoke all on function public.can_access_legacy_attachment(text) from public;
grant execute on function public.can_access_legacy_attachment(text) to authenticated;
grant execute on function public.can_access_legacy_attachment(text) to service_role;

revoke all on function public.record_client_payment(bigint, text, numeric, numeric, timestamp with time zone, text, text) from public;
grant execute on function public.record_client_payment(bigint, text, numeric, numeric, timestamp with time zone, text, text) to authenticated;

revoke all on function public.transition_commission(bigint, text, date, timestamp with time zone, text, text) from public;
grant execute on function public.transition_commission(bigint, text, date, timestamp with time zone, text, text) to authenticated;

revoke all on function public.replace_commission(bigint, text, numeric, text) from public;
grant execute on function public.replace_commission(bigint, text, numeric, text) to authenticated;

revoke all on function public.reassign_deal(bigint, bigint, text) from public;
grant execute on function public.reassign_deal(bigint, bigint, text) to authenticated;

revoke all on function public.update_sales_commission_rates(bigint, bigint, numeric, numeric) from public;
grant execute on function public.update_sales_commission_rates(bigint, bigint, numeric, numeric) to service_role;



  create policy "CRM files select own or admin"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'attachments'::text) AND (public.is_admin() OR ((storage.foldername(name))[1] = (public.current_sales_id())::text) OR ((COALESCE(array_length(storage.foldername(name), 1), 0) = 0) AND public.can_access_legacy_attachment(name)))));



  create policy "CRM files update own or admin"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'attachments'::text) AND (public.is_admin() OR ((storage.foldername(name))[1] = (public.current_sales_id())::text) OR ((COALESCE(array_length(storage.foldername(name), 1), 0) = 0) AND public.can_access_legacy_attachment(name)))));


