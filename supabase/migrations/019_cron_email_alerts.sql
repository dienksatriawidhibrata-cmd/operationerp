-- Migration 019: Automated email alerts via pg_cron + pg_net
--
-- SETUP WAJIB sebelum jalankan migration ini:
-- Ganti [PROJECT_REF] dan [CRON_SECRET] dengan nilai aktual, lalu jalankan
-- di SQL Editor Supabase:
--
--   ALTER DATABASE postgres SET app.supabase_url = 'https://[PROJECT_REF].supabase.co';
--   ALTER DATABASE postgres SET app.cron_secret  = '[CRON_SECRET]';
--
-- CRON_SECRET harus sama persis dengan env var CRON_SECRET di Edge Function.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper function to call the Edge Function
CREATE OR REPLACE FUNCTION trigger_deadline_alert(shift_type text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  base_url text := current_setting('app.supabase_url', true);
  secret   text := current_setting('app.cron_secret', true);
BEGIN
  IF base_url IS NULL OR base_url = '' THEN
    RAISE WARNING 'app.supabase_url not configured — skipping deadline alert';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := base_url || '/functions/v1/send-deadline-alerts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || COALESCE(secret, '')
    ),
    body    := jsonb_build_object('shift', shift_type)
  );
END;
$$;

-- Ceklis Pagi + Preparation Pagi → 08:15 WIB = 01:15 UTC
SELECT cron.schedule(
  'email-alert-pagi',
  '15 1 * * *',
  $$ SELECT trigger_deadline_alert('pagi'); $$
);

-- Ceklis Middle + Prep Middle + Setoran + Laporan Harian → 14:15 WIB = 07:15 UTC
SELECT cron.schedule(
  'email-alert-middle',
  '15 7 * * *',
  $$ SELECT trigger_deadline_alert('middle'); $$
);

-- Ceklis Malam → 22:15 WIB = 15:15 UTC
SELECT cron.schedule(
  'email-alert-malam',
  '15 15 * * *',
  $$ SELECT trigger_deadline_alert('malam'); $$
);
