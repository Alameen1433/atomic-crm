-- Recreated views do not retain their previous ACLs. Restore the API grants
-- after the commission migrations rebuild the CRM summary views.
grant all on table public.activity_log to anon, authenticated, service_role;
grant all on table public.companies_summary to anon, authenticated, service_role;
grant all on table public.contacts_summary to anon, authenticated, service_role;
