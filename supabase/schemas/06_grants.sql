--
-- Grants
-- This file declares all grants and default privileges for the public schema.
--

-- Schema usage
grant usage on schema public to postgres;
grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;

-- Function grants
grant all on function public.cleanup_note_attachments() to anon;
grant all on function public.cleanup_note_attachments() to authenticated;
grant all on function public.cleanup_note_attachments() to service_role;

grant all on function public.get_avatar_for_email(text) to anon;
grant all on function public.get_avatar_for_email(text) to authenticated;
grant all on function public.get_avatar_for_email(text) to service_role;

grant all on function public.get_domain_favicon(text) to anon;
grant all on function public.get_domain_favicon(text) to authenticated;
grant all on function public.get_domain_favicon(text) to service_role;

grant all on function public.get_note_attachments_function_url() to anon;
grant all on function public.get_note_attachments_function_url() to authenticated;
grant all on function public.get_note_attachments_function_url() to service_role;

revoke all on function public.get_user_id_by_email(text) from public;
grant all on function public.get_user_id_by_email(text) to service_role;

grant all on function public.handle_company_saved() to anon;
grant all on function public.handle_company_saved() to authenticated;
grant all on function public.handle_company_saved() to service_role;

grant all on function public.handle_contact_note_created_or_updated() to anon;
grant all on function public.handle_contact_note_created_or_updated() to authenticated;
grant all on function public.handle_contact_note_created_or_updated() to service_role;

grant all on function public.handle_contact_saved() to anon;
grant all on function public.handle_contact_saved() to authenticated;
grant all on function public.handle_contact_saved() to service_role;

grant all on function public.handle_new_user() to anon;
grant all on function public.handle_new_user() to authenticated;
grant all on function public.handle_new_user() to service_role;

grant all on function public.handle_update_user() to anon;
grant all on function public.handle_update_user() to authenticated;
grant all on function public.handle_update_user() to service_role;

grant all on function public.is_admin() to anon;
grant all on function public.is_admin() to authenticated;
grant all on function public.is_admin() to service_role;

grant all on function public.lowercase_email_jsonb() to anon;
grant all on function public.lowercase_email_jsonb() to authenticated;
grant all on function public.lowercase_email_jsonb() to service_role;

grant all on function public.merge_contacts(bigint, bigint) to anon;
grant all on function public.merge_contacts(bigint, bigint) to authenticated;
grant all on function public.merge_contacts(bigint, bigint) to service_role;

grant all on function public.set_sales_id_default() to anon;
grant all on function public.set_sales_id_default() to authenticated;
grant all on function public.set_sales_id_default() to service_role;

grant all on function public.set_child_sales_id_from_parent() to authenticated;
grant all on function public.set_child_sales_id_from_parent() to service_role;
grant all on function public.validate_deal_contacts_owner() to authenticated;
grant all on function public.validate_deal_contacts_owner() to service_role;

grant all on function public.current_sales_id() to authenticated;
grant all on function public.current_sales_id() to service_role;

revoke all on function public.can_access_legacy_attachment(text) from public;
grant execute on function public.can_access_legacy_attachment(text) to authenticated;
grant execute on function public.can_access_legacy_attachment(text) to service_role;

grant all on function public.set_deal_commission_rate_snapshots() to authenticated;
grant all on function public.set_deal_commission_rate_snapshots() to service_role;

grant all on function public.protect_deal_commission_fields() to authenticated;
grant all on function public.protect_deal_commission_fields() to service_role;

revoke all on function public.record_client_payment(bigint, text, numeric, numeric, timestamp with time zone, text, text) from public;
grant execute on function public.record_client_payment(bigint, text, numeric, numeric, timestamp with time zone, text, text) to authenticated;

revoke all on function public.transition_commission(bigint, text, date, timestamp with time zone, text, text) from public;
grant execute on function public.transition_commission(bigint, text, date, timestamp with time zone, text, text) to authenticated;

revoke all on function public.replace_commission(bigint, text, numeric, text) from public;
grant execute on function public.replace_commission(bigint, text, numeric, text) to authenticated;

revoke all on function public.reassign_deal(bigint, bigint, text) from public;
grant execute on function public.reassign_deal(bigint, bigint, text) to authenticated;

-- Internal RPC invoked by the users edge function with the service role key,
-- not by the browser.
revoke all on function public.update_sales_commission_rates(bigint, bigint, numeric, numeric) from public;
grant execute on function public.update_sales_commission_rates(bigint, bigint, numeric, numeric) to service_role;

revoke all on function public.prepare_sales_user_deletion(bigint, bigint, bigint, text) from public;
grant execute on function public.prepare_sales_user_deletion(bigint, bigint, bigint, text) to service_role;

revoke all on function public.finalize_sales_user_deletion(bigint) from public;
grant execute on function public.finalize_sales_user_deletion(bigint) to service_role;

revoke all on function public.sync_sales_identity() from public;
revoke all on function public.ensure_attachment_namespace() from public;
revoke all on function public.guard_auth_user_deletion() from public;

-- Table grants
grant all on table public.companies to anon;
grant all on table public.companies to authenticated;
grant all on table public.companies to service_role;

grant all on table public.contacts to anon;
grant all on table public.contacts to authenticated;
grant all on table public.contacts to service_role;

grant all on table public.contact_notes to anon;
grant all on table public.contact_notes to authenticated;
grant all on table public.contact_notes to service_role;

grant all on table public.deals to anon;
grant all on table public.deals to authenticated;
grant all on table public.deals to service_role;

grant all on table public.deal_notes to anon;
grant all on table public.deal_notes to authenticated;
grant all on table public.deal_notes to service_role;

grant all on table public.sales to anon;
grant all on table public.sales to authenticated;
grant all on table public.sales to service_role;
revoke delete on table public.sales from anon;
revoke delete on table public.sales from authenticated;

revoke all on table public.sales_identities from anon;
revoke all on table public.sales_identities from authenticated;
revoke all on table public.sales_identities from service_role;
grant select on table public.sales_identities to authenticated;
grant select on table public.sales_identities to service_role;

revoke all on table public.attachment_namespaces from anon;
revoke all on table public.attachment_namespaces from authenticated;
revoke all on table public.attachment_namespaces from service_role;
grant select on table public.attachment_namespaces to authenticated;
grant select on table public.attachment_namespaces to service_role;

grant all on table public.tags to anon;
grant all on table public.tags to authenticated;
grant all on table public.tags to service_role;

grant all on table public.tasks to anon;
grant all on table public.tasks to authenticated;
grant all on table public.tasks to service_role;

-- Commission audit tables are only mutated by the SECURITY DEFINER RPCs
-- (running as the function owner). API roles get read-only access; ANY
-- broader grant (e.g. TRUNCATE, which bypasses RLS) is revoked to override
-- the privileges granted when the tables were created.
revoke all on table public.commissions from anon;
revoke all on table public.commissions from authenticated;
revoke all on table public.commissions from service_role;
grant select on table public.commissions to authenticated;
grant select on table public.commissions to service_role;

revoke all on table public.commission_events from anon;
revoke all on table public.commission_events from authenticated;
revoke all on table public.commission_events from service_role;
grant select on table public.commission_events to authenticated;
grant select on table public.commission_events to service_role;

revoke all on table public.sales_commission_rate_history from anon;
revoke all on table public.sales_commission_rate_history from authenticated;
revoke all on table public.sales_commission_rate_history from service_role;
grant select on table public.sales_commission_rate_history to authenticated;
grant select on table public.sales_commission_rate_history to service_role;

revoke all on table public.deal_ownership_events from anon;
revoke all on table public.deal_ownership_events from authenticated;
revoke all on table public.deal_ownership_events from service_role;
grant select on table public.deal_ownership_events to authenticated;
grant select on table public.deal_ownership_events to service_role;

revoke all on table public.user_deletion_events from anon;
revoke all on table public.user_deletion_events from authenticated;
revoke all on table public.user_deletion_events from service_role;
grant select on table public.user_deletion_events to authenticated;
grant select on table public.user_deletion_events to service_role;

grant all on table public.configuration to anon;
grant all on table public.configuration to authenticated;
grant all on table public.configuration to service_role;

grant all on table public.favicons_excluded_domains to anon;
grant all on table public.favicons_excluded_domains to authenticated;
grant all on table public.favicons_excluded_domains to service_role;

-- View grants
grant all on table public.activity_log to anon;
grant all on table public.activity_log to authenticated;
grant all on table public.activity_log to service_role;

grant all on table public.companies_summary to anon;
grant all on table public.companies_summary to authenticated;
grant all on table public.companies_summary to service_role;

grant all on table public.contacts_summary to anon;
grant all on table public.contacts_summary to authenticated;
grant all on table public.contacts_summary to service_role;

grant all on table public.init_state to anon;
grant all on table public.init_state to authenticated;
grant all on table public.init_state to service_role;

-- Sequence grants
grant all on sequence public.companies_id_seq to anon;
grant all on sequence public.companies_id_seq to authenticated;
grant all on sequence public.companies_id_seq to service_role;

grant all on sequence public."contactNotes_id_seq" to anon;
grant all on sequence public."contactNotes_id_seq" to authenticated;
grant all on sequence public."contactNotes_id_seq" to service_role;

grant all on sequence public.contacts_id_seq to anon;
grant all on sequence public.contacts_id_seq to authenticated;
grant all on sequence public.contacts_id_seq to service_role;

grant all on sequence public."dealNotes_id_seq" to anon;
grant all on sequence public."dealNotes_id_seq" to authenticated;
grant all on sequence public."dealNotes_id_seq" to service_role;

grant all on sequence public.deals_id_seq to anon;
grant all on sequence public.deals_id_seq to authenticated;
grant all on sequence public.deals_id_seq to service_role;

grant all on sequence public.favicons_excluded_domains_id_seq to anon;
grant all on sequence public.favicons_excluded_domains_id_seq to authenticated;
grant all on sequence public.favicons_excluded_domains_id_seq to service_role;

grant all on sequence public.sales_id_seq to anon;
grant all on sequence public.sales_id_seq to authenticated;
grant all on sequence public.sales_id_seq to service_role;

grant all on sequence public.tags_id_seq to anon;
grant all on sequence public.tags_id_seq to authenticated;
grant all on sequence public.tags_id_seq to service_role;

grant all on sequence public.tasks_id_seq to anon;
grant all on sequence public.tasks_id_seq to authenticated;
grant all on sequence public.tasks_id_seq to service_role;

-- The commission-table sequences are only used by the SECURITY DEFINER RPCs
-- as the function owner, so no grants are needed for API roles.

-- Default privileges
alter default privileges for role postgres in schema public grant all on sequences to postgres;
alter default privileges for role postgres in schema public grant all on sequences to anon;
alter default privileges for role postgres in schema public grant all on sequences to authenticated;
alter default privileges for role postgres in schema public grant all on sequences to service_role;

alter default privileges for role postgres in schema public grant all on functions to postgres;
alter default privileges for role postgres in schema public grant all on functions to anon;
alter default privileges for role postgres in schema public grant all on functions to authenticated;
alter default privileges for role postgres in schema public grant all on functions to service_role;

alter default privileges for role postgres in schema public grant all on tables to postgres;
alter default privileges for role postgres in schema public grant all on tables to anon;
alter default privileges for role postgres in schema public grant all on tables to authenticated;
alter default privileges for role postgres in schema public grant all on tables to service_role;
