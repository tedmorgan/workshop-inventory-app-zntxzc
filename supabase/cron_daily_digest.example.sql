-- Template: copy to a local file (see .gitignore), replace YOUR_CRON_SECRET, run in SQL Editor.
-- Enable extensions: pg_cron, pg_net. Project ref from Dashboard → Settings → API.

-- SELECT cron.unschedule('daily-inventory-digest');  -- if recreating the job

-- SELECT cron.schedule(
--   'daily-inventory-digest',
--   '0 13 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://bnyyfypaudhisookytoq.supabase.co/functions/v1/daily-inventory-digest',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR_CRON_SECRET'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
