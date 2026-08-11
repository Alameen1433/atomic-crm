drop trigger if exists "set_contact_notes_sales_id_trigger" on "public"."contact_notes";

drop trigger if exists "set_deal_notes_sales_id_trigger" on "public"."deal_notes";

drop trigger if exists "set_task_sales_id_trigger" on "public"."tasks";

drop policy "Deals update own or admin" on "public"."deals";

drop view if exists "public"."activity_log";

drop view if exists "public"."companies_summary";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.set_child_sales_id_from_parent()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_table_name = 'contact_notes' or tg_table_name = 'tasks' then
    select sales_id into new.sales_id
      from public.contacts where id = new.contact_id;
  elsif tg_table_name = 'deal_notes' then
    select sales_id into new.sales_id
      from public.deals where id = new.deal_id;
  end if;
  if new.sales_id is null then
    raise exception 'Parent record or owner not found';
  end if;
  return new;
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
    where c.id is null or c.sales_id <> new.sales_id
  ) then
    raise exception 'All deal contacts must belong to the deal owner';
  end if;
  return new;
end;
$function$
;

create or replace view "public"."activity_log" with (security_invoker=on) as  SELECT (('company.'::text || c.id) || '.created'::text) AS id,
    'company.created'::text AS type,
    c.created_at AS date,
    c.id AS company_id,
    c.sales_id,
    to_json(c.*) AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note
   FROM public.companies c
UNION ALL
 SELECT (('contact.'::text || co.id) || '.created'::text) AS id,
    'contact.created'::text AS type,
    co.first_seen AS date,
    co.company_id,
    co.sales_id,
    NULL::json AS company,
    to_json(co.*) AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note
   FROM public.contacts co
UNION ALL
 SELECT (('contactNote.'::text || cn.id) || '.created'::text) AS id,
    'contactNote.created'::text AS type,
    cn.date,
    co.company_id,
    cn.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    to_json(cn.*) AS contact_note,
    NULL::json AS deal_note
   FROM (public.contact_notes cn
     LEFT JOIN public.contacts co ON ((co.id = cn.contact_id)))
UNION ALL
 SELECT (('deal.'::text || d.id) || '.created'::text) AS id,
    'deal.created'::text AS type,
    d.created_at AS date,
    d.company_id,
    d.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    to_json(d.*) AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note
   FROM public.deals d
UNION ALL
 SELECT (('dealNote.'::text || dn.id) || '.created'::text) AS id,
    'dealNote.created'::text AS type,
    dn.date,
    d.company_id,
    dn.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    to_json(dn.*) AS deal_note
   FROM (public.deal_notes dn
     LEFT JOIN public.deals d ON ((d.id = dn.deal_id)));


create or replace view "public"."companies_summary" with (security_invoker=on) as  SELECT c.id,
    c.created_at,
    c.name,
    c.sector,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.sales_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    c.archived_at,
    count(DISTINCT d.id) AS nb_deals,
    count(DISTINCT co.id) AS nb_contacts
   FROM ((public.companies c
     LEFT JOIN public.deals d ON ((c.id = d.company_id)))
     LEFT JOIN public.contacts co ON ((c.id = co.company_id)))
  GROUP BY c.id;


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
  pending_commission public.commissions%rowtype;
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


  create policy "Deals update own or admin"
  on "public"."deals"
  as permissive
  for update
  to authenticated
using ((public.is_admin() OR (sales_id = public.current_sales_id())))
with check (((public.is_admin() OR (sales_id = public.current_sales_id())) AND ((company_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = deals.company_id) AND (public.is_admin() OR (c.sales_id = public.current_sales_id()))))))));


CREATE TRIGGER "30_validate_deal_contacts_owner" BEFORE INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.validate_deal_contacts_owner();

CREATE TRIGGER set_contact_notes_sales_id_trigger BEFORE INSERT OR UPDATE ON public.contact_notes FOR EACH ROW EXECUTE FUNCTION public.set_child_sales_id_from_parent();

CREATE TRIGGER set_deal_notes_sales_id_trigger BEFORE INSERT OR UPDATE ON public.deal_notes FOR EACH ROW EXECUTE FUNCTION public.set_child_sales_id_from_parent();

CREATE TRIGGER set_task_sales_id_trigger BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_child_sales_id_from_parent();

