-- ================================
-- TABLE NOTIFICATIONS (in-app)
-- ================================
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_see_own_notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "user_mark_read"
ON notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_manage_notifications"
ON notifications FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ================================
-- FONCTION : créer les notifs in-app
-- ================================
CREATE OR REPLACE FUNCTION public.notify_expiring_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- J-7 : une seule notif par user par jour
  INSERT INTO notifications (user_id, type, title, message)
  SELECT
    s.user_id,
    'subscription_expiring_7days',
    'Abonnement bientôt expiré',
    'Votre abonnement ' || s.plan || ' expire dans 7 jours. Renouvelez-le pour continuer à utiliser BoutikOS.'
  FROM subscriptions s
  WHERE s.status = 'active'
    AND s.expires_at::date = (NOW() + INTERVAL '7 days')::date
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.user_id
        AND n.type = 'subscription_expiring_7days'
        AND n.created_at::date = NOW()::date
    );

  -- J-1 : urgence
  INSERT INTO notifications (user_id, type, title, message)
  SELECT
    s.user_id,
    'subscription_expiring_1day',
    'Dernier jour !',
    'Votre abonnement ' || s.plan || ' expire demain. Renouvelez maintenant pour éviter toute interruption.'
  FROM subscriptions s
  WHERE s.status = 'active'
    AND s.expires_at::date = (NOW() + INTERVAL '1 day')::date
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.user_id
        AND n.type = 'subscription_expiring_1day'
        AND n.created_at::date = NOW()::date
    );
END;
$$;

-- Cron : tous les jours à 8h du matin
SELECT cron.schedule(
  'notify-expiring-subscriptions',
  '0 8 * * *',
  'SELECT public.notify_expiring_subscriptions()'
);
