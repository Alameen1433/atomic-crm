-- Preserve custom branding while replacing the original product name.
update public.configuration
set config = jsonb_set(config, '{title}', '"Xenora CRM"'::jsonb, true)
where config ->> 'title' is null
   or config ->> 'title' = 'Atomic CRM';
