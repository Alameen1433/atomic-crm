set check_function_bodies = off;


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
      where n.sales_id = public.current_sales_id()
      union all
      select n.sales_id, unnest(n.attachments) as attachment
      from public.deal_notes n
      where n.sales_id = public.current_sales_id()
    ) note_attachment
    where note_attachment.attachment ->> 'path' = object_name
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
                  on regexp_replace(target_phone.value ->> 'number', '\D', '', 'g')
                    = regexp_replace(source_phone.value ->> 'number', '\D', '', 'g')
                where regexp_replace(source_phone.value ->> 'number', '\D', '', 'g') <> ''
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
