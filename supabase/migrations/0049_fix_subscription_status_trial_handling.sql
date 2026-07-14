-- Migration 0049 : corrige get_boutique_subscription_status pour reconnaître les essais gratuits
-- et les boutiques suspendues, comme le fait déjà is_subscription_active(). La version d'origine
-- (0047) ne testait que status = 'active', ignorant status = 'trial' — un utilisateur en essai
-- gratuit actif se serait vu injustement bloqué par le paywall côté front (voir App.tsx).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_boutique_subscription_status(p_boutique_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_boutique_id uuid;
  v_result jsonb;
BEGIN
  SELECT role, boutique_id INTO v_role, v_boutique_id FROM profils WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'super_admin' AND (v_boutique_id IS NULL OR v_boutique_id <> p_boutique_id) THEN
    RAISE EXCEPTION 'Accès refusé à cette boutique';
  END IF;

  SELECT jsonb_build_object(
    'actif', (s.plan IS NOT NULL AND NOT COALESCE(b.suspended, false)),
    'plan', s.plan,
    'date_fin', s.expires_at
  )
  INTO v_result
  FROM boutiques b
  LEFT JOIN LATERAL (
    SELECT plan, status, expires_at, is_trial
    FROM subscriptions
    WHERE user_id = b.gerant_id
      AND expires_at > now()
      AND (status = 'active' OR (status = 'trial' AND is_trial = true))
    ORDER BY expires_at DESC
    LIMIT 1
  ) s ON true
  WHERE b.id = p_boutique_id;

  RETURN COALESCE(v_result, jsonb_build_object('actif', false, 'plan', null, 'date_fin', null));
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
