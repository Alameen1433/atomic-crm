--
-- Functions
-- This file declares all PL/pgSQL functions in the public schema.
--

CREATE OR REPLACE FUNCTION "public"."cleanup_note_attachments"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    DECLARE
      payload jsonb;
      request_headers jsonb;
      auth_header text;
    BEGIN
      request_headers := coalesce(
        nullif(current_setting('request.headers', true), '')::jsonb,
        '{}'::jsonb
      );
      auth_header := request_headers ->> 'authorization';

      IF auth_header IS NULL OR auth_header = '' THEN
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;

        RETURN NEW;
      END IF;

      payload := jsonb_build_object(
        'old_record', OLD,
        'record', NEW,
        'type', TG_OP
      );

      PERFORM net.http_post(
        url := public.get_note_attachments_function_url(),
        body := payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type',
          'application/json',
          'Authorization',
          auth_header
        ),
        timeout_milliseconds := 10000
      );

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      RETURN NEW;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."get_avatar_for_email"("email" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare email_hash text;
declare gravatar_url text;
declare gravatar_status int8;
declare email_domain text;
declare favicon_url text;
declare domain_status int8;

begin
    -- Try to fetch a gravatar image
    email_hash = encode(extensions.digest(email, 'sha256'), 'hex');
    gravatar_url = concat('https://www.gravatar.com/avatar/', email_hash, '?d=404');

    select status from extensions.http_get(gravatar_url) into gravatar_status;

    if gravatar_status = 200 then
        return gravatar_url;
    end if;

    -- Fallback to email's domain favicon if not excluded
    email_domain = split_part(email, '@', 2);
    return get_domain_favicon(email_domain);
exception
    when others then
        return 'ERROR';
end;
$$;

CREATE OR REPLACE FUNCTION "public"."get_domain_favicon"("domain_name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare domain_status int8;

begin
    if exists (select from favicons_excluded_domains as fav where fav.domain = domain_name) then
        return null;
    end if;

    return concat(
        'https://favicon.show/',
        (regexp_matches(domain_name, '^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)', 'i'))[1]
    );
end;
$$;

CREATE OR REPLACE FUNCTION "public"."get_note_attachments_function_url"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
    DECLARE
      issuer text;
      function_url text;
    BEGIN
      issuer := coalesce(
        nullif(current_setting('request.jwt.claim.iss', true), ''),
        (
          coalesce(
            nullif(current_setting('request.jwt.claims', true), ''),
            '{}'
          )::jsonb ->> 'iss'
        )
      );
      issuer := nullif(issuer, '');
      IF issuer IS NOT NULL THEN
        issuer := rtrim(issuer, '/');
        IF right(issuer, 8) = '/auth/v1' THEN
          function_url :=
            left(issuer, length(issuer) - 8) || '/functions/v1/delete_note_attachments';

          IF function_url LIKE 'http://127.0.0.1:%' THEN
            RETURN replace(
              function_url,
              'http://127.0.0.1:',
              'http://host.docker.internal:'
            );
          END IF;

          IF function_url LIKE 'http://localhost:%' THEN
            RETURN replace(
              function_url,
              'http://localhost:',
              'http://host.docker.internal:'
            );
          END IF;

          RETURN function_url;
        END IF;
      END IF;

      RETURN 'http://host.docker.internal:54321/functions/v1/delete_note_attachments';
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("email" "text") RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
BEGIN
  RETURN QUERY SELECT au.id FROM auth.users au WHERE au.email = $1;
END;
$_$;

CREATE OR REPLACE FUNCTION "public"."handle_company_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare company_logo text;

begin
    if new.logo is not null then
        return new;
    end if;

    company_logo = get_domain_favicon(new.website);
    if company_logo is null then
        return new;
    end if;

    new.logo = concat('{"src":"', company_logo, '","title":"Company favicon"}');
    return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_contact_note_created_or_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.contacts set last_seen = new.date where contacts.id = new.contact_id and contacts.last_seen < new.date;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_contact_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$declare contact_avatar text;
declare emails_length int8;
declare item jsonb;

begin
    if new.avatar is not null then
        return new;
    end if;

    select coalesce(jsonb_array_length(new.email_jsonb), 0) into emails_length;

    if emails_length = 0 then
        return new;
    end if;

    for item in select jsonb_array_elements(new.email_jsonb)
    loop
        select public.get_avatar_for_email(item->>'email') into contact_avatar;
        if (contact_avatar is not null) then
            exit;
        end if;
    end loop;

    if contact_avatar is null then
        return new;
    end if;

    new.avatar = concat('{"src":"', contact_avatar, '"}');
    return new;
end;$$;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  sales_count int;
begin
  select count(id) into sales_count
  from public.sales;

  insert into public.sales (first_name, last_name, email, user_id, administrator)
  values (
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    new.email,
    new.id,
    case when sales_count > 0 then FALSE else TRUE end
  );
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_update_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.sales
  set
    first_name = coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    last_name = coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    email = new.email
  where user_id = new.id;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1 from public.sales where user_id = auth.uid() and administrator = true and disabled = false
  );
end;
$$;

CREATE OR REPLACE FUNCTION "public"."merge_contacts"("loser_id" bigint, "winner_id" bigint) RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  winner_contact contacts%ROWTYPE;
  loser_contact contacts%ROWTYPE;
  deal_record RECORD;
  merged_emails jsonb;
  merged_phones jsonb;
  merged_tags bigint[];
  winner_emails jsonb;
  loser_emails jsonb;
  winner_phones jsonb;
  loser_phones jsonb;
  email_map jsonb;
  phone_map jsonb;
BEGIN
  -- Fetch both contacts
  SELECT * INTO winner_contact FROM contacts WHERE id = winner_id;
  SELECT * INTO loser_contact FROM contacts WHERE id = loser_id;

  IF winner_contact IS NULL OR loser_contact IS NULL THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- 1. Reassign tasks from loser to winner
  UPDATE tasks SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 2. Reassign contact notes from loser to winner
  UPDATE contact_notes SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 3. Update deals - replace loser with winner in contact_ids array
  FOR deal_record IN
    SELECT id, contact_ids
    FROM deals
    WHERE contact_ids @> ARRAY[loser_id]
  LOOP
    UPDATE deals
    SET contact_ids = (
      SELECT ARRAY(
        SELECT DISTINCT unnest(
          array_remove(deal_record.contact_ids, loser_id) || ARRAY[winner_id]
        )
      )
    )
    WHERE id = deal_record.id;
  END LOOP;

  -- 4. Merge contact data

  -- Get email arrays
  winner_emails := COALESCE(winner_contact.email_jsonb, '[]'::jsonb);
  loser_emails := COALESCE(loser_contact.email_jsonb, '[]'::jsonb);

  -- Merge emails with deduplication by email address
  -- Build a map of email -> email object, then convert back to array
  email_map := '{}'::jsonb;

  -- Add winner emails to map
  IF jsonb_array_length(winner_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_emails)-1 LOOP
      email_map := email_map || jsonb_build_object(
        winner_emails->i->>'email',
        winner_emails->i
      );
    END LOOP;
  END IF;

  -- Add loser emails to map (won't overwrite existing keys)
  IF jsonb_array_length(loser_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_emails)-1 LOOP
      IF NOT email_map ? (loser_emails->i->>'email') THEN
        email_map := email_map || jsonb_build_object(
          loser_emails->i->>'email',
          loser_emails->i
        );
      END IF;
    END LOOP;
  END IF;

  -- Convert map back to array
  merged_emails := (SELECT jsonb_agg(value) FROM jsonb_each(email_map));
  merged_emails := COALESCE(merged_emails, '[]'::jsonb);

  -- Get phone arrays
  winner_phones := COALESCE(winner_contact.phone_jsonb, '[]'::jsonb);
  loser_phones := COALESCE(loser_contact.phone_jsonb, '[]'::jsonb);

  -- Merge phones with deduplication by number
  phone_map := '{}'::jsonb;

  -- Add winner phones to map
  IF jsonb_array_length(winner_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_phones)-1 LOOP
      phone_map := phone_map || jsonb_build_object(
        winner_phones->i->>'number',
        winner_phones->i
      );
    END LOOP;
  END IF;

  -- Add loser phones to map (won't overwrite existing keys)
  IF jsonb_array_length(loser_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_phones)-1 LOOP
      IF NOT phone_map ? (loser_phones->i->>'number') THEN
        phone_map := phone_map || jsonb_build_object(
          loser_phones->i->>'number',
          loser_phones->i
        );
      END IF;
    END LOOP;
  END IF;

  -- Convert map back to array
  merged_phones := (SELECT jsonb_agg(value) FROM jsonb_each(phone_map));
  merged_phones := COALESCE(merged_phones, '[]'::jsonb);

  -- Merge tags (remove duplicates)
  merged_tags := ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(winner_contact.tags, ARRAY[]::bigint[]) ||
      COALESCE(loser_contact.tags, ARRAY[]::bigint[])
    )
  );

  -- 5. Update winner with merged data
  UPDATE contacts SET
    avatar = COALESCE(winner_contact.avatar, loser_contact.avatar),
    gender = COALESCE(winner_contact.gender, loser_contact.gender),
    first_name = COALESCE(winner_contact.first_name, loser_contact.first_name),
    last_name = COALESCE(winner_contact.last_name, loser_contact.last_name),
    title = COALESCE(winner_contact.title, loser_contact.title),
    company_id = COALESCE(winner_contact.company_id, loser_contact.company_id),
    email_jsonb = merged_emails,
    phone_jsonb = merged_phones,
    linkedin_url = COALESCE(winner_contact.linkedin_url, loser_contact.linkedin_url),
    background = COALESCE(winner_contact.background, loser_contact.background),
    has_newsletter = COALESCE(winner_contact.has_newsletter, loser_contact.has_newsletter),
    first_seen = LEAST(COALESCE(winner_contact.first_seen, loser_contact.first_seen), COALESCE(loser_contact.first_seen, winner_contact.first_seen)),
    last_seen = GREATEST(COALESCE(winner_contact.last_seen, loser_contact.last_seen), COALESCE(loser_contact.last_seen, winner_contact.last_seen)),
    sales_id = COALESCE(winner_contact.sales_id, loser_contact.sales_id),
    tags = merged_tags
  WHERE id = winner_id;

  -- 6. Delete loser contact
  DELETE FROM contacts WHERE id = loser_id;

  RETURN winner_id;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."lowercase_email_jsonb"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.email_jsonb IS NOT NULL THEN
    NEW.email_jsonb = COALESCE((
      SELECT jsonb_agg(
        jsonb_set(elem, '{email}', to_jsonb(LOWER(elem->>'email')))
      )
      FROM jsonb_array_elements(NEW.email_jsonb) AS elem
    ), '[]'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."set_sales_id_default"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.sales_id IS NULL THEN
    NEW.sales_id := public.current_sales_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."current_sales_id"() RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select id from public.sales where user_id = auth.uid() and disabled = false limit 1;
$$;

CREATE OR REPLACE FUNCTION "public"."set_deal_commission_rate_snapshots"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  partner public.sales%rowtype;
begin
  if new.sales_id is null then
    new.sales_id := public.current_sales_id();
  end if;

  select * into partner from public.sales where id = new.sales_id;
  if partner.id is null then
    raise exception 'Sales partner not found';
  end if;

  new.new_commission_rate_snapshot := partner.new_client_commission_rate;
  new.recurring_commission_rate_snapshot := partner.recurring_client_commission_rate;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."protect_deal_commission_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then
    new.sales_id := old.sales_id;
    new.new_commission_rate_snapshot := old.new_commission_rate_snapshot;
    new.recurring_commission_rate_snapshot := old.recurring_commission_rate_snapshot;
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."record_client_payment"(
    "deal_id" bigint,
    "confirmed_client_type" text,
    "final_invoice_total" numeric,
    "first_payment_amount" numeric,
    "first_payment_received_at" timestamp with time zone,
    "first_payment_reference" text default null,
    "internal_note" text default null
) RETURNS public.commissions
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION "public"."transition_commission"(
    "commission_id" bigint,
    "new_status" text,
    "scheduled_for" date default null,
    "paid_at" timestamp with time zone default null,
    "payout_reference" text default null,
    "reason" text default null
) RETURNS public.commissions
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
#variable_conflict use_variable
declare
  actor_id bigint;
  current_record public.commissions%rowtype;
  updated_record public.commissions%rowtype;
  allowed boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can update commissions';
  end if;
  actor_id := public.current_sales_id();

  select * into current_record from public.commissions where id = commission_id for update;
  if current_record.id is null then
    raise exception 'Commission not found';
  end if;

  allowed :=
    (current_record.status = 'pending_review' and new_status in ('approved', 'rejected')) or
    (current_record.status = 'approved' and new_status in ('scheduled', 'paid', 'reversed')) or
    (current_record.status = 'scheduled' and new_status in ('approved', 'paid', 'reversed')) or
    (current_record.status = 'paid' and new_status = 'reversed');
  if not allowed then
    raise exception 'Invalid commission status transition from % to %', current_record.status, new_status;
  end if;
  if new_status = 'scheduled' and scheduled_for is null then
    raise exception 'A scheduled payout date is required';
  end if;
  if new_status = 'paid' and (paid_at is null or nullif(payout_reference, '') is null) then
    raise exception 'Paid date and payout reference are required';
  end if;
  if new_status in ('rejected', 'reversed') and nullif(reason, '') is null then
    raise exception 'A reason is required';
  end if;

  update public.commissions set
    status = new_status,
    scheduled_for = case when new_status = 'scheduled' then scheduled_for else commissions.scheduled_for end,
    paid_at = case when new_status = 'paid' then paid_at else commissions.paid_at end,
    payout_reference = case when new_status = 'paid' then payout_reference else commissions.payout_reference end,
    reason = case when new_status in ('rejected', 'reversed') then reason else commissions.reason end,
    updated_at = now()
  where id = commission_id
  returning * into updated_record;

  insert into public.commission_events (
    commission_id, actor_sales_id, event_type, previous_status, new_status, reason
  ) values (
    commission_id, actor_id, 'status_changed', current_record.status, new_status, nullif(reason, '')
  );
  return updated_record;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."replace_commission"(
    "commission_id" bigint,
    "confirmed_client_type" text,
    "final_invoice_total" numeric,
    "reason" text
) RETURNS public.commissions
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
#variable_conflict use_variable
declare
  actor_id bigint;
  current_record public.commissions%rowtype;
  deal_record public.deals%rowtype;
  replacement public.commissions%rowtype;
  applied_rate numeric(5, 2);
  settled numeric(14, 2);
begin
  if not public.is_admin() then
    raise exception 'Only administrators can replace commissions';
  end if;
  if nullif(reason, '') is null then
    raise exception 'A replacement reason is required';
  end if;
  if confirmed_client_type not in ('new', 'recurring') or final_invoice_total <= 0 then
    raise exception 'Invalid replacement values';
  end if;
  actor_id := public.current_sales_id();

  select * into current_record from public.commissions where id = commission_id for update;
  if current_record.id is null or current_record.status not in ('approved', 'scheduled', 'paid') then
    raise exception 'Only approved, scheduled, or paid commissions can be replaced';
  end if;
  select * into deal_record from public.deals where id = current_record.deal_id;
  applied_rate := case confirmed_client_type
    when 'new' then deal_record.new_commission_rate_snapshot
    else deal_record.recurring_commission_rate_snapshot
  end;
  settled := current_record.prior_settled_amount +
    case when current_record.status = 'paid' then current_record.balance_amount else 0 end;

  update public.commissions set status = 'reversed', reason = reason, updated_at = now()
    where id = commission_id;
  insert into public.commission_events (
    commission_id, actor_sales_id, event_type, previous_status, new_status, reason
  ) values (
    commission_id, actor_id, 'reversed_for_replacement', current_record.status, 'reversed', reason
  );

  insert into public.commissions (
    deal_id, sales_id, confirmed_client_type, final_invoice_total,
    applied_rate, commission_amount, prior_settled_amount,
    first_payment_amount, first_payment_received_at, first_payment_reference,
    status, internal_note, replacement_for_id, created_by
  ) values (
    current_record.deal_id, current_record.sales_id, confirmed_client_type,
    final_invoice_total, applied_rate,
    round(final_invoice_total * applied_rate / 100, 2), settled,
    current_record.first_payment_amount, current_record.first_payment_received_at,
    current_record.first_payment_reference, 'pending_review', current_record.internal_note,
    current_record.id, actor_id
  ) returning * into replacement;

  insert into public.commission_events (
    commission_id, actor_sales_id, event_type, new_status, reason,
    details
  ) values (
    replacement.id, actor_id, 'replacement_created', replacement.status, reason,
    jsonb_build_object('replaces', current_record.id, 'prior_settled_amount', settled)
  );
  return replacement;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."reassign_deal"(
    "deal_id" bigint,
    "new_sales_id" bigint,
    "reason" text
) RETURNS public.deals
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION "public"."set_child_sales_id_from_parent"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION "public"."validate_deal_contacts_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
$$;

-- Called by the users edge function with the service role to atomically
-- update a partner's commission rates and record the audit history row:
-- both writes happen in this function's transaction, so neither persists if
-- the other fails. Authorization is enforced by the edge function; execute is
-- only granted to service_role (see 06_grants.sql).
CREATE OR REPLACE FUNCTION "public"."update_sales_commission_rates"(
    "p_sales_id" bigint,
    "p_actor_sales_id" bigint,
    "p_new_new_rate" numeric(5, 2),
    "p_new_recurring_rate" numeric(5, 2)
) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION "public"."can_access_legacy_attachment"("object_name" text) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;
