
-- ================================
-- BOUTIKOS — SUPER ADMIN PANEL
-- Suspension boutiques, stats plateforme, audit log, gestion abonnements
-- ================================

-- 1. Colonnes suspension sur boutiques
ALTER TABLE public.boutiques
  ADD COLUMN IF NOT EXISTS suspended        BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- 2. Table audit log admin
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID        NOT NULL REFERENCES auth.users(id),
  action      TEXT        NOT NULL,
  target_type TEXT,
  target_id   UUID,
  details     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_audit_log"
  ON public.admin_audit_log FOR SELECT
  USING ((SELECT role FROM public.profils WHERE id = auth.uid()) = 'super_admin');

CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id   ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.admin_audit_log(created_at DESC);

-- 3. Corriger handle_new_user — restaurer toute la logique
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  existing_count    INTEGER;
  assigned_role     TEXT;
  assigned_boutique UUID;
BEGIN
  -- a) Client final (portail débiteur)
  IF NEW.raw_user_meta_data->>'user_type' = 'client' THEN
    INSERT INTO public.client_accounts (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  -- b) Utilisateur invité via Edge Function invite-user
  IF NEW.raw_user_meta_data->>'boutique_id' IS NOT NULL THEN
    assigned_role     := COALESCE(NEW.raw_user_meta_data->>'role', 'caissier');
    assigned_boutique := (NEW.raw_user_meta_data->>'boutique_id')::UUID;

    UPDATE public.invitations
    SET status = 'accepted', accepted_at = NOW()
    WHERE email = NEW.email
      AND status = 'pending'
      AND expires_at > NOW();

  ELSE
    -- c) Bootstrap : les 3 premiers comptes = super_admin
    SELECT COUNT(*) INTO existing_count FROM public.profils;
    IF existing_count < 3 THEN
      assigned_role := 'super_admin';
    ELSE
      assigned_role := 'caissier';
    END IF;
    assigned_boutique := NULL;
  END IF;

  INSERT INTO public.profils (id, role, boutique_id)
  VALUES (NEW.id, assigned_role, assigned_boutique)
  ON CONFLICT (id) DO NOTHING;

  -- super_admin → abonnement lifetime gratuit automatique
  IF assigned_role = 'super_admin' THEN
    INSERT INTO public.subscriptions (
      user_id, plan, status, payment_method, amount, net_amount, starts_at, expires_at
    )
    VALUES (NEW.id, 'annual', 'active', 'admin', 0, 0, NOW(), '2099-12-31 23:59:59+00')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Étendre is_subscription_active pour bloquer les boutiques suspendues
CREATE OR REPLACE FUNCTION public.is_subscription_active(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = uid
        AND status = 'active'
        AND expires_at > NOW()
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.profils WHERE id = uid AND boutique_id IS NOT NULL
      )
      OR
      NOT EXISTS (
        SELECT 1 FROM public.boutiques b
        JOIN public.profils p ON p.boutique_id = b.id
        WHERE p.id = uid AND b.suspended = true
      )
    );
$$;

-- 5. RPC admin_get_platform_stats
CREATE OR REPLACE FUNCTION public.admin_get_platform_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_result JSON;
BEGIN
  IF (SELECT role FROM public.profils WHERE id = auth.uid()) != 'super_admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT json_build_object(
    'boutiques_total',      (SELECT COUNT(*) FROM public.boutiques),
    'boutiques_actives',    (SELECT COUNT(*) FROM public.boutiques WHERE suspended = false),
    'boutiques_suspendues', (SELECT COUNT(*) FROM public.boutiques WHERE suspended = true),
    'users_total',          (SELECT COUNT(*) FROM public.profils),
    'abonnements_actifs',   (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active' AND expires_at > NOW()),
    'abonnements_expires',  (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'expired' OR (status = 'active' AND expires_at <= NOW())),
    'ventes_count',         (SELECT COUNT(*) FROM public.ventes),
    'ventes_montant_total', (SELECT COALESCE(SUM(total), 0) FROM public.ventes),
    'ardoises_en_cours',    (SELECT COUNT(*) FROM public.ardoises WHERE statut = 'en_cours'),
    'ardoises_soldees',     (SELECT COUNT(*) FROM public.ardoises WHERE statut = 'soldee'),
    'clients_inscrits',     (SELECT COUNT(*) FROM public.client_accounts),
    'revenue_plateforme',   (SELECT COALESCE(SUM(net_amount), 0) FROM public.subscriptions WHERE status = 'active' AND payment_method != 'admin')
  ) INTO v_result;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_platform_stats() TO authenticated;

-- 6. RPC admin_get_boutiques
CREATE OR REPLACE FUNCTION public.admin_get_boutiques()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_result JSON;
BEGIN
  IF (SELECT role FROM public.profils WHERE id = auth.uid()) != 'super_admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT json_agg(
    json_build_object(
      'id',               b.id,
      'nom',              b.nom,
      'adresse',          b.adresse,
      'suspended',        b.suspended,
      'suspended_at',     b.suspended_at,
      'suspended_reason', b.suspended_reason,
      'created_at',       b.created_at,
      'users_count',      (SELECT COUNT(*) FROM public.profils p WHERE p.boutique_id = b.id),
      'ventes_count',     (SELECT COUNT(*) FROM public.ventes v WHERE v.boutique_id = b.id),
      'ventes_montant',   (SELECT COALESCE(SUM(v.total), 0) FROM public.ventes v WHERE v.boutique_id = b.id),
      'ardoises_en_cours',(SELECT COUNT(*) FROM public.ardoises a WHERE a.boutique_id = b.id AND a.statut = 'en_cours'),
      'subscription', (
        SELECT row_to_json(s.*)
        FROM public.subscriptions s
        JOIN public.profils p ON p.id = s.user_id AND p.boutique_id = b.id
        WHERE s.status = 'active' AND s.expires_at > NOW()
        ORDER BY s.expires_at DESC
        LIMIT 1
      )
    ) ORDER BY b.created_at DESC
  ) INTO v_result FROM public.boutiques b;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_boutiques() TO authenticated;

-- 7. RPC admin_suspend_boutique
CREATE OR REPLACE FUNCTION public.admin_suspend_boutique(p_boutique_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT role FROM public.profils WHERE id = auth.uid()) != 'super_admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  UPDATE public.boutiques
  SET suspended = true, suspended_at = NOW(), suspended_reason = p_reason
  WHERE id = p_boutique_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'suspend_boutique', 'boutique', p_boutique_id,
    json_build_object('reason', p_reason)::jsonb);

  RETURN json_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_suspend_boutique(UUID, TEXT) TO authenticated;

-- 8. RPC admin_unsuspend_boutique
CREATE OR REPLACE FUNCTION public.admin_unsuspend_boutique(p_boutique_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT role FROM public.profils WHERE id = auth.uid()) != 'super_admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  UPDATE public.boutiques
  SET suspended = false, suspended_at = NULL, suspended_reason = NULL
  WHERE id = p_boutique_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'unsuspend_boutique', 'boutique', p_boutique_id, '{}'::jsonb);

  RETURN json_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_unsuspend_boutique(UUID) TO authenticated;

-- 9. RPC admin_set_subscription
CREATE OR REPLACE FUNCTION public.admin_set_subscription(
  p_user_id UUID,
  p_plan    TEXT,
  p_months  INT DEFAULT 1
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_expires TIMESTAMPTZ;
BEGIN
  IF (SELECT role FROM public.profils WHERE id = auth.uid()) != 'super_admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT GREATEST(NOW(), COALESCE(MAX(expires_at), NOW()))
  INTO v_expires
  FROM public.subscriptions
  WHERE user_id = p_user_id AND status = 'active' AND expires_at > NOW();

  v_expires := v_expires + (p_months || ' months')::INTERVAL;

  INSERT INTO public.subscriptions (
    user_id, plan, status, payment_method, amount, net_amount, starts_at, expires_at
  )
  VALUES (p_user_id, p_plan::plan_type, 'active', 'admin', 0, 0, NOW(), v_expires);

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'set_subscription', 'user', p_user_id,
    json_build_object('plan', p_plan, 'months', p_months, 'expires_at', v_expires)::jsonb);

  RETURN json_build_object('success', true, 'expires_at', v_expires);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription(UUID, TEXT, INT) TO authenticated;
