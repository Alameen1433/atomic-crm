drop view if exists "public"."activity_log";

drop view if exists "public"."companies_summary";

update public.deals d
set
  new_commission_rate_snapshot = coalesce(
    d.new_commission_rate_snapshot,
    s.new_client_commission_rate,
    20.00
  ),
  recurring_commission_rate_snapshot = coalesce(
    d.recurring_commission_rate_snapshot,
    s.recurring_client_commission_rate,
    15.00
  )
from public.sales s
where s.id = d.sales_id;

update public.deals
set
  new_commission_rate_snapshot = coalesce(new_commission_rate_snapshot, 20.00),
  recurring_commission_rate_snapshot = coalesce(recurring_commission_rate_snapshot, 15.00)
where new_commission_rate_snapshot is null
   or recurring_commission_rate_snapshot is null;

alter table "public"."deals" alter column "new_commission_rate_snapshot" set not null;

alter table "public"."deals" alter column "recurring_commission_rate_snapshot" set not null;

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


