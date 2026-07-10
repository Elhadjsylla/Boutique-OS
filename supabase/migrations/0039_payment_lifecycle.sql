-- Migration 0039 : Fiabilisation du cycle de vie des paiements Wave/Orange Money
-- 1. Enum: ajoute 'failed' à subscription_status
-- 2. Colonnes: confirmed_at, payment_url sur subscriptions
-- 3. Index: unitech_reference pour matching webhook O(1)
-- 4. RPC: get_subscription_status(uuid) — polling front sécurisé par ownership
-- 5. Fonction + cron: expire les pending sans webhook après 30 min

BEGIN;

-- ══════════════════════════════════════════════════════════════
-- 1. Enum subscription_status : ajouter 'failed'
-- ══════════════════════════════════════════════════════════════

ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'failed';

-- ══════════════════════════════════════════════════════════════
-- 2. Colonnes supplémentaires sur subscriptions
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS confirmed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_url   TEXT;

-- ══════════════════════════════════════════════════════════════
-- 3. Index sur unitech_reference pour matching webhook rapide
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_subscriptions_unitech_reference
  ON public.subscriptions(unitech_reference)
  WHERE unitech_reference IS NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- 4. RPC get_subscription_status(p_subscription_id)
--    Polling sécurisé par ownership — seul le propriétaire peut poller.
--    Ne retourne JAMAIS le statut d'une sub appartenant à quelqu'un d'autre.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_subscription_status(p_subscription_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_sub RECORD;
BEGIN
  SELECT
    s.id,
    s.status::TEXT      AS status,
    s.confirmed_at,
    s.expires_at,
    s.payment_method::TEXT AS payment_method
  INTO v_sub
  FROM subscriptions s
  WHERE s.id = p_subscription_id
    AND s.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Souscription introuvable ou accès non autorisé'
      USING HINT = '404';
  END IF;

  RETURN jsonb_build_object(
    'status',         v_sub.status,
    'confirmed_at',   v_sub.confirmed_at,
    'expires_at',     v_sub.expires_at,
    'payment_method', v_sub.payment_method
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_status(UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 5. Cron : expirer les subscriptions 'pending' sans webhook après 30 min
--    Évite les enregistrements orphelins qui n'ont jamais reçu de webhook.
--    Utilise 'failed' pour distinguer un paiement échoué d'une annulation volontaire.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.expire_stale_pending_subscriptions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE subscriptions
  SET status = 'failed'
  WHERE status = 'pending'
    AND payment_method::TEXT IN ('wave', 'orange_money')
    AND created_at < NOW() - INTERVAL '30 minutes';
END;
$$;

SELECT cron.schedule(
  'expire-pending-subscriptions',
  '*/5 * * * *',
  'SELECT public.expire_stale_pending_subscriptions()'
);

NOTIFY pgrst, 'reload schema';

COMMIT;
