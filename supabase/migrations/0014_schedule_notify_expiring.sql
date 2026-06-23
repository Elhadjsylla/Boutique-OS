-- ============================================================
-- CRON : notifier les abonnements expirant bientôt
-- Appelle l'Edge Function notify-expiring chaque jour à 8h UTC
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'notify-expiring-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://utpgotetbzobsjnhbqkc.supabase.co/functions/v1/notify-expiring',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-cron-secret',  'cd17cc952a93266c1289bb39b3bd733803240c49eb914fe4ad23f37a5ef7fccf'
    ),
    body    := '{}'::jsonb
  );
  $$
);
