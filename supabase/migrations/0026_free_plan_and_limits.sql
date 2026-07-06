-- ============================================================
-- 0026_free_plan_and_limits.sql
-- Free plan: assigned by default at signup, replaces the
-- immediate paywall. Adds plan_limits config table and
-- check_quota / get_user_plan_and_limits RPCs for the front.
-- ============================================================

-- ── 1. Extend plan_type enum ──────────────────────────────────
ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'free' BEFORE 'starter';

-- ── 2. plan_limits table (central config, front reads it) ─────
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan             TEXT    PRIMARY KEY,
  max_articles     INT     NOT NULL DEFAULT -1,   -- -1 = illimité
  max_ventes_mois  INT     NOT NULL DEFAULT -1,
  max_caissiers    INT     NOT NULL DEFAULT 1,
  modules_bloques  TEXT[]  NOT NULL DEFAULT '{}'  -- clés de modules bloqués
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

-- N'importe quel utilisateur authentifié peut lire les limites (pas sensible)
CREATE POLICY "plan_limits_authenticated_read"
ON public.plan_limits FOR SELECT
TO authenticated
USING (true);

-- Seul le service_role peut modifier la config
CREATE POLICY "plan_limits_service_manage"
ON public.plan_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ── 3. Seed plan_limits ───────────────────────────────────────
-- modules_bloques : clés reconnues par le front
--   'export_pdf'       → export PDF/Excel désactivé
--   'dashboard_avance' → analytics avancés désactivés
INSERT INTO public.plan_limits (plan, max_articles, max_ventes_mois, max_caissiers, modules_bloques)
VALUES
  ('free',    30,   100,  1,   ARRAY['export_pdf', 'dashboard_avance']),
  ('trial',   -1,   -1,   1,   ARRAY[]::TEXT[]),
  ('starter', -1,   -1,   1,   ARRAY['export_pdf', 'dashboard_avance']),
  ('pro',     -1,   -1,   3,   ARRAY[]::TEXT[]),
  ('annual',  -1,   -1,   -1,  ARRAY[]::TEXT[])
ON CONFLICT (plan) DO UPDATE SET
  max_articles    = EXCLUDED.max_articles,
  max_ventes_mois = EXCLUDED.max_ventes_mois,
  max_caissiers   = EXCLUDED.max_caissiers,
  modules_bloques = EXCLUDED.modules_bloques;

-- ── 4. handle_new_user : free plan au lieu du trial 7 jours ──
-- Les super_admins gardent leurs abonnements lifetime créés
-- par la migration 0010. On ne touche pas à leur cas ici.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  new_boutique_id      uuid;
  boutique_name_val    text;
  meta_boutique_id_str text;
BEGIN
  boutique_name_val    := NEW.raw_user_meta_data->>'boutique_name';
  meta_boutique_id_str := NEW.raw_user_meta_data->>'boutique_id';

  IF boutique_name_val IS NOT NULL AND boutique_name_val != '' THEN
    -- Nouveau marchand : créer la boutique + profil gerant + plan free
    BEGIN
      new_boutique_id := meta_boutique_id_str::uuid;
    EXCEPTION WHEN OTHERS THEN
      new_boutique_id := gen_random_uuid();
    END;

    INSERT INTO public.boutiques (id, nom, gerant_id)
    VALUES (new_boutique_id, boutique_name_val, NEW.id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profils (id, role, boutique_id)
    VALUES (NEW.id, 'gerant', new_boutique_id)
    ON CONFLICT (id) DO NOTHING;

    -- Plan free : accès immédiat sans paywall, durée indéfinie, avec limites
    INSERT INTO public.subscriptions (
      user_id, plan, status, payment_method,
      amount, net_amount, is_trial,
      starts_at, expires_at
    )
    SELECT
      NEW.id, 'free', 'active', 'admin',
      0, 0, false,
      NOW(), '2099-12-31 23:59:59+00'::timestamptz
    WHERE NOT EXISTS (
      SELECT 1 FROM public.subscriptions WHERE user_id = NEW.id
    );

  ELSE
    -- Utilisateur invité / caissier : profil basique sans abonnement propre
    INSERT INTO public.profils (id, role, boutique_id)
    VALUES (NEW.id, 'caissier', NULL)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 5. start_free_trial : autoriser les utilisateurs free ─────
-- Avant : bloqué si UNE subscription existe.
-- Après  : autorisé si seul le plan free existe (pas encore de trial/paid).
CREATE OR REPLACE FUNCTION public.start_free_trial(p_plan TEXT DEFAULT 'starter')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sub_id  UUID;
BEGIN
  -- Bloquer si l'utilisateur a déjà un abonnement non-free (trial ou payant)
  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = v_user_id
      AND plan::TEXT != 'free'
  ) THEN
    RETURN jsonb_build_object('error', 'Un abonnement ou essai existe déjà');
  END IF;

  IF p_plan NOT IN ('starter', 'pro', 'annual') THEN
    RETURN jsonb_build_object('error', 'Plan invalide');
  END IF;

  INSERT INTO public.subscriptions (
    user_id, plan, status, payment_method, amount,
    starts_at, expires_at, is_trial, cancellation_deadline
  ) VALUES (
    v_user_id,
    p_plan::plan_type,
    'trial',
    'admin',
    0,
    NOW(),
    NOW() + INTERVAL '30 days',
    true,
    NOW() + INTERVAL '7 days'
  ) RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object(
    'success',               true,
    'subscription_id',       v_sub_id,
    'trial_ends_at',         NOW() + INTERVAL '30 days',
    'cancellation_deadline', NOW() + INTERVAL '7 days'
  );
END;
$$;

-- ── 6. get_user_plan_and_limits() ────────────────────────────
-- Retourne le plan effectif + ses limites pour l'utilisateur appelant.
-- Priorité : paid/trial > free (un trial ou abo payant l'emporte sur le free).
-- Utilisé par le front pour afficher les quotas et bloquer les actions.
CREATE OR REPLACE FUNCTION public.get_user_plan_and_limits()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role    TEXT;
  v_plan    TEXT;
  v_limits  public.plan_limits%ROWTYPE;
BEGIN
  SELECT role INTO v_role FROM public.profils WHERE id = v_user_id;

  -- super_admin : illimité, pas besoin de requête plan_limits
  IF v_role = 'super_admin' THEN
    RETURN jsonb_build_object(
      'plan',            'annual',
      'max_articles',    -1,
      'max_ventes_mois', -1,
      'max_caissiers',   -1,
      'modules_bloques', '[]'::jsonb
    );
  END IF;

  -- Plan effectif : non-free en priorité (trial/paid), puis free comme fallback
  SELECT plan::TEXT INTO v_plan
  FROM public.subscriptions
  WHERE user_id = v_user_id
    AND status IN ('active', 'trial')
    AND expires_at > NOW()
  ORDER BY
    CASE WHEN plan::TEXT = 'free' THEN 1 ELSE 0 END,
    expires_at DESC
  LIMIT 1;

  v_plan := COALESCE(v_plan, 'free');

  SELECT * INTO v_limits FROM public.plan_limits WHERE plan = v_plan;

  RETURN jsonb_build_object(
    'plan',            v_plan,
    'max_articles',    COALESCE(v_limits.max_articles,    -1),
    'max_ventes_mois', COALESCE(v_limits.max_ventes_mois, -1),
    'max_caissiers',   COALESCE(v_limits.max_caissiers,   1),
    'modules_bloques', to_jsonb(COALESCE(v_limits.modules_bloques, ARRAY[]::TEXT[]))
  );
END;
$$;

-- ── 7. check_quota(quota_type) ────────────────────────────────
-- Vérifie l'usage actuel vs la limite du plan pour une métrique donnée.
-- Retourne : { quota_type, plan, current, max, exceeded, unlimited }
-- Valeurs quota_type : 'articles' | 'ventes_mois'
-- Appelé par le front avant un INSERT pour vérifier le quota.
CREATE OR REPLACE FUNCTION public.check_quota(p_quota_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_boutique UUID;
  v_plan     TEXT;
  v_current  INT  := 0;
  v_max      INT;
BEGIN
  SELECT boutique_id INTO v_boutique FROM public.profils WHERE id = v_user_id;

  -- Plan effectif (même priorité que get_user_plan_and_limits)
  SELECT plan::TEXT INTO v_plan
  FROM public.subscriptions
  WHERE user_id = v_user_id
    AND status IN ('active', 'trial')
    AND expires_at > NOW()
  ORDER BY
    CASE WHEN plan::TEXT = 'free' THEN 1 ELSE 0 END,
    expires_at DESC
  LIMIT 1;
  v_plan := COALESCE(v_plan, 'free');

  IF p_quota_type = 'articles' THEN
    SELECT max_articles INTO v_max FROM public.plan_limits WHERE plan = v_plan;
    IF v_max != -1 AND v_boutique IS NOT NULL THEN
      SELECT COUNT(*)::INT INTO v_current
      FROM public.produits
      WHERE boutique_id = v_boutique
        AND archive = false;
    END IF;

  ELSIF p_quota_type = 'ventes_mois' THEN
    SELECT max_ventes_mois INTO v_max FROM public.plan_limits WHERE plan = v_plan;
    IF v_max != -1 AND v_boutique IS NOT NULL THEN
      SELECT COUNT(*)::INT INTO v_current
      FROM public.ventes
      WHERE boutique_id = v_boutique
        AND created_at >= date_trunc('month', NOW());
    END IF;

  ELSE
    RETURN jsonb_build_object('error', 'quota_type invalide: ' || p_quota_type);
  END IF;

  RETURN jsonb_build_object(
    'quota_type', p_quota_type,
    'plan',       v_plan,
    'current',    v_current,
    'max',        COALESCE(v_max, -1),
    'exceeded',   (v_max IS NOT NULL AND v_max != -1 AND v_current >= v_max),
    'unlimited',  (v_max IS NULL OR v_max = -1)
  );
END;
$$;

-- ── 8. Permissions ────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_user_plan_and_limits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_quota(TEXT) TO authenticated;
