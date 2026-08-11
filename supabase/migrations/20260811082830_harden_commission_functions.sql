revoke delete on table "public"."commission_events" from "authenticated";

revoke insert on table "public"."commission_events" from "authenticated";

revoke references on table "public"."commission_events" from "authenticated";

revoke trigger on table "public"."commission_events" from "authenticated";

revoke truncate on table "public"."commission_events" from "authenticated";

revoke update on table "public"."commission_events" from "authenticated";

revoke delete on table "public"."commission_events" from "service_role";

revoke insert on table "public"."commission_events" from "service_role";

revoke update on table "public"."commission_events" from "service_role";

revoke delete on table "public"."commissions" from "authenticated";

revoke insert on table "public"."commissions" from "authenticated";

revoke references on table "public"."commissions" from "authenticated";

revoke trigger on table "public"."commissions" from "authenticated";

revoke truncate on table "public"."commissions" from "authenticated";

revoke update on table "public"."commissions" from "authenticated";

revoke delete on table "public"."commissions" from "service_role";

revoke insert on table "public"."commissions" from "service_role";

revoke update on table "public"."commissions" from "service_role";

revoke delete on table "public"."deal_ownership_events" from "authenticated";

revoke insert on table "public"."deal_ownership_events" from "authenticated";

revoke references on table "public"."deal_ownership_events" from "authenticated";

revoke trigger on table "public"."deal_ownership_events" from "authenticated";

revoke truncate on table "public"."deal_ownership_events" from "authenticated";

revoke update on table "public"."deal_ownership_events" from "authenticated";

revoke delete on table "public"."deal_ownership_events" from "service_role";

revoke insert on table "public"."deal_ownership_events" from "service_role";

revoke update on table "public"."deal_ownership_events" from "service_role";

revoke delete on table "public"."sales_commission_rate_history" from "authenticated";

revoke insert on table "public"."sales_commission_rate_history" from "authenticated";

revoke references on table "public"."sales_commission_rate_history" from "authenticated";

revoke trigger on table "public"."sales_commission_rate_history" from "authenticated";

revoke truncate on table "public"."sales_commission_rate_history" from "authenticated";

revoke update on table "public"."sales_commission_rate_history" from "authenticated";

revoke delete on table "public"."sales_commission_rate_history" from "service_role";

revoke insert on table "public"."sales_commission_rate_history" from "service_role";

revoke update on table "public"."sales_commission_rate_history" from "service_role";

-- Align the remaining privileges on the commission audit tables with
-- supabase/schemas/06_grants.sql: API roles keep read-only access only, and
-- TRUNCATE (which bypasses RLS) is removed for every API role as well.
revoke all on table "public"."commissions" from "anon";

revoke all on table "public"."commissions" from "service_role";

grant select on table "public"."commissions" to "service_role";

revoke all on table "public"."commission_events" from "anon";

revoke all on table "public"."commission_events" from "service_role";

grant select on table "public"."commission_events" to "service_role";

revoke all on table "public"."sales_commission_rate_history" from "anon";

revoke all on table "public"."sales_commission_rate_history" from "service_role";

grant select on table "public"."sales_commission_rate_history" to "service_role";

revoke all on table "public"."deal_ownership_events" from "anon";

revoke all on table "public"."deal_ownership_events" from "service_role";

grant select on table "public"."deal_ownership_events" to "service_role";

CREATE INDEX commissions_deal_id_idx ON public.commissions USING btree (deal_id);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_sales_commission_rates(p_sales_id bigint, p_actor_sales_id bigint, p_new_new_rate numeric, p_new_recurring_rate numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare
  previous_record public.sales%rowtype;
begin
  if p_new_new_rate < 0 or p_new_new_rate > 100
    or p_new_recurring_rate < 0 or p_new_recurring_rate > 100 then
    raise exception 'Commission rates must be between 0 and 100';
  end if;

  select * into previous_record from public.sales where id = p_sales_id for update;
  if previous_record.id is null then
    raise exception 'Sales partner not found';
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

CREATE OR REPLACE FUNCTION public.current_sales_id()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select id from public.sales where user_id = auth.uid() and disabled = false limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return exists (
    select 1 from public.sales where user_id = auth.uid() and administrator = true and disabled = false
  );
end;
$function$
;

-- Function privileges for the internal rate-update RPC (mirrors
-- supabase/schemas/06_grants.sql): only the users edge function's service
-- role key may invoke it.
revoke all on function public.update_sales_commission_rates(bigint, bigint, numeric, numeric) from public;

grant execute on function public.update_sales_commission_rates(bigint, bigint, numeric, numeric) to service_role;

-- The commission-table sequences are only used by the SECURITY DEFINER RPCs
-- as the function owner; API roles do not need direct access.
revoke all on sequence "public"."commissions_id_seq" from "authenticated";

revoke all on sequence "public"."commissions_id_seq" from "service_role";

revoke all on sequence "public"."commission_events_id_seq" from "authenticated";

revoke all on sequence "public"."commission_events_id_seq" from "service_role";

revoke all on sequence "public"."sales_commission_rate_history_id_seq" from "authenticated";

revoke all on sequence "public"."sales_commission_rate_history_id_seq" from "service_role";

revoke all on sequence "public"."deal_ownership_events_id_seq" from "authenticated";

revoke all on sequence "public"."deal_ownership_events_id_seq" from "service_role";

CREATE OR REPLACE FUNCTION public.record_client_payment(deal_id bigint, confirmed_client_type text, final_invoice_total numeric, first_payment_amount numeric, first_payment_received_at timestamp with time zone, first_payment_reference text DEFAULT NULL::text, internal_note text DEFAULT NULL::text)
 RETURNS public.commissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare
  actor_id bigint;
  deal_record public.deals%rowtype;
  commission_record public.commissions%rowtype;
  applied_rate numeric(5, 2);
begin
  if not public.is_admin() then
    raise exception 'Only administrators can record client payments';
  end if;
  actor_id := public.current_sales_id();

  if confirmed_client_type not in ('new', 'recurring') then
    raise exception 'Invalid client type';
  end if;
  if final_invoice_total <= 0 or first_payment_amount <= 0 then
    raise exception 'Invoice total and first payment must be positive';
  end if;
  if first_payment_amount > final_invoice_total then
    raise exception 'First payment cannot exceed the invoice total';
  end if;

  select * into deal_record from public.deals where id = deal_id for update;
  if deal_record.id is null then
    raise exception 'Deal not found';
  end if;
  if deal_record.stage <> 'won' then
    raise exception 'Client payment can only be recorded for a won deal';
  end if;
  -- Guard against duplicate payments before relying on the
  -- commissions_one_active_per_deal_idx unique index as a fallback
  if exists (
    select 1 from public.commissions c
    where c.deal_id = deal_record.id and c.status not in ('rejected', 'reversed')
  ) then
    raise exception 'An active commission already exists for this deal';
  end if;

  applied_rate := case confirmed_client_type
    when 'new' then deal_record.new_commission_rate_snapshot
    else deal_record.recurring_commission_rate_snapshot
  end;

  insert into public.commissions (
    deal_id, sales_id, confirmed_client_type, final_invoice_total,
    applied_rate, commission_amount, first_payment_amount,
    first_payment_received_at, first_payment_reference, internal_note, created_by
  ) values (
    deal_record.id, deal_record.sales_id, confirmed_client_type,
    final_invoice_total, applied_rate,
    round(final_invoice_total * applied_rate / 100, 2),
    first_payment_amount, first_payment_received_at,
    nullif(first_payment_reference, ''), nullif(internal_note, ''), actor_id
  ) returning * into commission_record;

  insert into public.commission_events (
    commission_id, actor_sales_id, event_type, new_status, details
  ) values (
    commission_record.id, actor_id, 'created', commission_record.status,
    jsonb_build_object(
      'final_invoice_total', commission_record.final_invoice_total,
      'applied_rate', commission_record.applied_rate,
      'commission_amount', commission_record.commission_amount
    )
  );

  return commission_record;
end;
$function$
;


