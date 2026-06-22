-- Activer pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Fonction qui expire les abonnements dépassés
CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INT;
BEGIN
  UPDATE subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  IF expired_count > 0 THEN
    RAISE LOG 'expire_subscriptions: % abonnement(s) expiré(s)', expired_count;
  END IF;
END;
$$;

-- Planifier : toutes les heures à la minute 0
SELECT cron.schedule(
  'expire-subscriptions',
  '0 * * * *',
  'SELECT public.expire_subscriptions()'
);
