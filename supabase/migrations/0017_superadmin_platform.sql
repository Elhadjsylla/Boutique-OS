-- ============================================================
-- BoutikOS — Migration 0017 : Plateforme Super Admin
-- ============================================================
-- Contenu :
--   1. Colonne suspended sur boutiques
--   2. Table admin_audit_log
--   3. Policy subscriptions pour super_admin
--   4. RPC admin_platform_stats()
--   5. RPC admin_boutique_details(uuid)
--   6. RPC admin_toggle_boutique_suspend(uuid, bool, text)
--   7. RPC admin_update_subscription(uuid, text, timestamptz)
--   8. Policies restrictives pour boutiques suspendues
-- ============================================================

BEGIN;

-- ============================================================
-- 1. SUSPENSION DES BOUTIQUES
-- ============================================================

ALTER TABLE public.boutiques
  ADD COLUMN IF NOT EXISTS suspended        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_boutiques_suspended ON public.boutiques(suspended);

-- Index performance pour les RPCs admin
CREATE INDEX IF NOT EXISTS idx_ventes_created_at ON public.ventes(created_at);


-- ============================================================
-- 2. TABLE ADMIN_AUDIT_LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   UUID,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action  ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_target  ON public.admin_audit_log(target_type, target_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Seul super_admin peut lire
CREATE POLICY "super_admin_read_audit"
ON public.admin_audit_log FOR SELECT
USING (COALESCE(auth.jwt() ->> 'role', '') = 'super_admin');

-- Insertion uniquement via SECURITY DEFINER (RPCs) ou service_role
CREATE POLICY "service_role_manage_audit"
ON public.admin_audit_log FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- 3. SUPER ADMIN VOIT TOUS LES ABONNEMENTS
-- ============================================================

CREATE POLICY "super_admin_read_all_subscriptions"
ON public.subscriptions FOR SELECT
USING (COALESCE(auth.jwt() ->> 'role', '') = 'super_admin');

CREATE POLICY "super_admin_read_all_payment_logs"
ON public.payment_logs FOR SELECT
USING (COALESCE(auth.jwt() ->> 'role', '') = 'super_admin');


-- ============================================================
-- 4. RPC : STATS GLOBALES PLATEFORME
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSON;
  caller_role TEXT := auth.jwt() ->> 'role';
BEGIN
  IF COALESCE(caller_role, '') <> 'super_admin' THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  SELECT json_build_object(
    'total_boutiques',      (SELECT COUNT(*) FROM public.boutiques),
    'active_boutiques',     (SELECT COUNT(*) FROM public.boutiques WHERE suspended = false),
    'suspended_boutiques',  (SELECT COUNT(*) FROM public.boutiques WHERE suspended = true),
    'total_users',          (SELECT COUNT(*) FROM public.profils),
    'total_sales_today',    (SELECT COUNT(*) FROM public.ventes
                             WHERE created_at >= date_trunc('day', NOW())),
    'total_sales_week',     (SELECT COUNT(*) FROM public.ventes
                             WHERE created_at >= NOW() - INTERVAL '7 days'),
    'total_sales_month',    (SELECT COUNT(*) FROM public.ventes
                             WHERE created_at >= NOW() - INTERVAL '30 days'),
    'ca_today',             COALESCE((SELECT SUM(total) FROM public.ventes
                             WHERE created_at >= date_trunc('day', NOW())), 0),
    'ca_week',              COALESCE((SELECT SUM(total) FROM public.ventes
                             WHERE created_at >= NOW() - INTERVAL '7 days'), 0),
    'ca_month',             COALESCE((SELECT SUM(total) FROM public.ventes
                             WHERE created_at >= NOW() - INTERVAL '30 days'), 0),
    'active_subscriptions', (SELECT COUNT(*) FROM public.subscriptions
                             WHERE status = 'active' AND expires_at > NOW()),
    'expired_subscriptions',(SELECT COUNT(*) FROM public.subscriptions
                             WHERE status = 'expired' OR expires_at <= NOW())
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_platform_stats() TO authenticated;


-- ============================================================
-- 5. RPC : DÉTAILS D'UNE BOUTIQUE
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_boutique_details(boutique_uuid UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result      JSON;
  caller_role TEXT := auth.jwt() ->> 'role';
  b           RECORD;
  g           RECORD;
BEGIN
  IF COALESCE(caller_role, '') <> 'super_admin' THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  -- Récupérer la boutique
  SELECT * INTO b FROM public.boutiques WHERE id = boutique_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boutique introuvable: %', boutique_uuid USING ERRCODE = 'P0002';
  END IF;

  -- Récupérer le gérant (s'il existe)
  IF b.gerant_id IS NOT NULL THEN
    SELECT p.id, u.email, p.role
    INTO g
    FROM public.profils p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = b.gerant_id;
  END IF;

  SELECT json_build_object(
    'id',               b.id,
    'nom',              b.nom,
    'adresse',          b.adresse,
    'suspended',        b.suspended,
    'suspended_at',     b.suspended_at,
    'suspended_reason', b.suspended_reason,
    'created_at',       b.created_at,
    'gerant',           CASE WHEN g.id IS NOT NULL
                        THEN json_build_object('id', g.id, 'email', g.email, 'role', g.role)
                        ELSE NULL END,
    'stats',            json_build_object(
      'total_users',    (SELECT COUNT(*) FROM public.profils WHERE boutique_id = boutique_uuid),
      'total_products', (SELECT COUNT(*) FROM public.produits WHERE boutique_id = boutique_uuid AND archive = false),
      'total_sales',    (SELECT COUNT(*) FROM public.ventes WHERE boutique_id = boutique_uuid),
      'ca_total',       COALESCE((SELECT SUM(total) FROM public.ventes WHERE boutique_id = boutique_uuid), 0),
      'ca_month',       COALESCE((SELECT SUM(total) FROM public.ventes
                         WHERE boutique_id = boutique_uuid AND created_at >= NOW() - INTERVAL '30 days'), 0),
      'open_ardoises',  (SELECT COUNT(*) FROM public.ardoises
                         WHERE boutique_id = boutique_uuid AND statut = 'en_cours'),
      'ardoises_amount',COALESCE((SELECT SUM(montant_total) FROM public.ardoises
                         WHERE boutique_id = boutique_uuid AND statut = 'en_cours'), 0)
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_boutique_details(UUID) TO authenticated;


-- ============================================================
-- 6. RPC : SUSPENDRE / RÉACTIVER UNE BOUTIQUE
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_toggle_boutique_suspend(
  boutique_uuid UUID,
  suspend       BOOLEAN,
  reason        TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_uid  UUID := auth.uid();
  caller_role TEXT := auth.jwt() ->> 'role';
  result      JSON;
BEGIN
  IF COALESCE(caller_role, '') <> 'super_admin' THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  UPDATE public.boutiques
  SET
    suspended        = suspend,
    suspended_at     = CASE WHEN suspend THEN NOW() ELSE NULL END,
    suspended_reason = CASE WHEN suspend THEN reason ELSE NULL END
  WHERE id = boutique_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boutique introuvable: %', boutique_uuid USING ERRCODE = 'P0002';
  END IF;

  -- Logger dans l'audit
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    caller_uid,
    CASE WHEN suspend THEN 'boutique.suspended' ELSE 'boutique.reactivated' END,
    'boutique',
    boutique_uuid,
    json_build_object('reason', reason, 'suspended', suspend)::jsonb
  );

  SELECT json_build_object(
    'success',      true,
    'boutique_id',  boutique_uuid,
    'suspended',    suspend,
    'suspended_at', CASE WHEN suspend THEN NOW() ELSE NULL END
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_boutique_suspend(UUID, BOOLEAN, TEXT) TO authenticated;


-- ============================================================
-- 7. RPC : MODIFIER UN ABONNEMENT MANUELLEMENT
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_update_subscription(
  target_user    UUID,
  new_plan       TEXT,
  new_expires_at TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_uid  UUID := auth.uid();
  caller_role TEXT := auth.jwt() ->> 'role';
  sub_id      UUID;
  old_plan    TEXT;
  result      JSON;
BEGIN
  IF COALESCE(caller_role, '') <> 'super_admin' THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  -- Valider le plan
  IF new_plan NOT IN ('starter', 'pro', 'annual') THEN
    RAISE EXCEPTION 'Plan invalide: %. Valeurs acceptées: starter, pro, annual', new_plan
      USING ERRCODE = '22023';
  END IF;

  -- Récupérer l'abonnement existant le plus récent
  SELECT id, plan::text INTO sub_id, old_plan
  FROM public.subscriptions
  WHERE user_id = target_user
  ORDER BY created_at DESC
  LIMIT 1;

  IF sub_id IS NULL THEN
    -- Créer un nouvel abonnement
    INSERT INTO public.subscriptions (user_id, plan, status, payment_method, amount, net_amount, starts_at, expires_at)
    VALUES (target_user, new_plan::plan_type, 'active', 'admin', 0, 0, NOW(), new_expires_at)
    RETURNING id INTO sub_id;
    old_plan := 'aucun';
  ELSE
    -- Mettre à jour l'existant
    UPDATE public.subscriptions
    SET
      plan       = new_plan::plan_type,
      status     = 'active',
      expires_at = new_expires_at,
      updated_at = NOW()
    WHERE id = sub_id;
  END IF;

  -- Logger
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    caller_uid,
    'subscription.updated',
    'subscription',
    sub_id,
    json_build_object(
      'user_id', target_user,
      'old_plan', old_plan,
      'new_plan', new_plan,
      'expires_at', new_expires_at
    )::jsonb
  );

  SELECT json_build_object(
    'success',         true,
    'subscription_id', sub_id,
    'plan',            new_plan,
    'expires_at',      new_expires_at
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_subscription(UUID, TEXT, TIMESTAMPTZ) TO authenticated;


-- ============================================================
-- 8. POLICIES RESTRICTIVES — BOUTIQUES SUSPENDUES
-- Appliquées en AND avec les policies existantes.
-- Bloquent toutes les opérations si la boutique est suspendue,
-- sauf pour le super_admin qui garde l'accès en lecture.
-- ============================================================

-- Produits
CREATE POLICY "block_suspended_produits"
ON public.produits AS RESTRICTIVE FOR ALL
USING (
  NOT EXISTS (
    SELECT 1 FROM public.boutiques
    WHERE boutiques.id = produits.boutique_id
    AND boutiques.suspended = true
  )
  OR COALESCE(auth.jwt() ->> 'role', '') = 'super_admin'
);

-- Ventes
CREATE POLICY "block_suspended_ventes"
ON public.ventes AS RESTRICTIVE FOR ALL
USING (
  NOT EXISTS (
    SELECT 1 FROM public.boutiques
    WHERE boutiques.id = ventes.boutique_id
    AND boutiques.suspended = true
  )
  OR COALESCE(auth.jwt() ->> 'role', '') = 'super_admin'
);

-- Vente items
CREATE POLICY "block_suspended_vente_items"
ON public.vente_items AS RESTRICTIVE FOR ALL
USING (
  NOT EXISTS (
    SELECT 1 FROM public.ventes
    JOIN public.boutiques ON boutiques.id = ventes.boutique_id
    WHERE ventes.id = vente_items.vente_id
    AND boutiques.suspended = true
  )
  OR COALESCE(auth.jwt() ->> 'role', '') = 'super_admin'
);

-- Ardoises
CREATE POLICY "block_suspended_ardoises"
ON public.ardoises AS RESTRICTIVE FOR ALL
USING (
  NOT EXISTS (
    SELECT 1 FROM public.boutiques
    WHERE boutiques.id = ardoises.boutique_id
    AND boutiques.suspended = true
  )
  OR COALESCE(auth.jwt() ->> 'role', '') = 'super_admin'
);

-- Ardoise paiements
CREATE POLICY "block_suspended_ardoise_paiements"
ON public.ardoise_paiements AS RESTRICTIVE FOR ALL
USING (
  NOT EXISTS (
    SELECT 1 FROM public.ardoises
    JOIN public.boutiques ON boutiques.id = ardoises.boutique_id
    WHERE ardoises.id = ardoise_paiements.ardoise_id
    AND boutiques.suspended = true
  )
  OR COALESCE(auth.jwt() ->> 'role', '') = 'super_admin'
);


COMMIT;
