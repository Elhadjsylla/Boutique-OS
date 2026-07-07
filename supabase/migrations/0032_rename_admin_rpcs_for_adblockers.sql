-- ==========================================
-- Migration 0032 : Rename admin endpoints to bypass adblockers
-- ==========================================

-- 1. Rename table admin_audit_log to sys_audit_log
ALTER TABLE IF EXISTS public.admin_audit_log RENAME TO sys_audit_log;

-- Rename indices
ALTER INDEX IF EXISTS idx_audit_log_admin_id RENAME TO idx_sys_audit_log_admin_id;
ALTER INDEX IF EXISTS idx_audit_log_created_at RENAME TO idx_sys_audit_log_created_at;
ALTER INDEX IF EXISTS idx_audit_log_created RENAME TO idx_sys_audit_log_created;
ALTER INDEX IF EXISTS idx_audit_log_action RENAME TO idx_sys_audit_log_action;
ALTER INDEX IF EXISTS idx_audit_log_target RENAME TO idx_sys_audit_log_target;

-- 2. Create sys_platform_metrics
CREATE OR REPLACE FUNCTION public.sys_platform_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  result      JSON;
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM public.profils WHERE id = auth.uid();
  IF COALESCE(caller_role, '') NOT IN ('super_admin', 'admin') THEN
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

-- 3. Create sys_boutique_details
CREATE OR REPLACE FUNCTION public.sys_boutique_details(boutique_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  result      JSON;
  caller_role TEXT;
  b           RECORD;
  g           RECORD;
BEGIN
  SELECT role INTO caller_role FROM public.profils WHERE id = auth.uid();
  IF COALESCE(caller_role, '') NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO b FROM public.boutiques WHERE id = boutique_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boutique introuvable: %', boutique_uuid USING ERRCODE = 'P0002';
  END IF;

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

-- 4. Create sys_toggle_boutique_suspend
CREATE OR REPLACE FUNCTION public.sys_toggle_boutique_suspend(boutique_uuid uuid, suspend boolean, reason text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  caller_uid  UUID := auth.uid();
  caller_role TEXT;
  result      JSON;
BEGIN
  SELECT role INTO caller_role FROM public.profils WHERE id = caller_uid;
  IF COALESCE(caller_role, '') NOT IN ('super_admin', 'admin') THEN
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

  INSERT INTO public.sys_audit_log (actor_id, action, target_type, target_id, details)
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

-- 5. Create sys_update_subscription
CREATE OR REPLACE FUNCTION public.sys_update_subscription(target_user uuid, new_plan text, new_expires_at timestamptz)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  caller_uid  UUID := auth.uid();
  caller_role TEXT;
  sub_id      UUID;
  old_plan    TEXT;
  result      JSON;
BEGIN
  SELECT role INTO caller_role FROM public.profils WHERE id = caller_uid;
  IF COALESCE(caller_role, '') NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  IF new_plan NOT IN ('starter', 'pro', 'annual') THEN
    RAISE EXCEPTION 'Plan invalide: %. Valeurs acceptées: starter, pro, annual', new_plan
      USING ERRCODE = '22023';
  END IF;

  SELECT id, plan::text INTO sub_id, old_plan
  FROM public.subscriptions
  WHERE user_id = target_user
  ORDER BY created_at DESC
  LIMIT 1;

  IF sub_id IS NULL THEN
    INSERT INTO public.subscriptions (user_id, plan, status, payment_method, amount, net_amount, starts_at, expires_at)
    VALUES (target_user, new_plan::plan_type, 'active', 'admin', 0, 0, NOW(), new_expires_at)
    RETURNING id INTO sub_id;
    old_plan := 'aucun';
  ELSE
    UPDATE public.subscriptions
    SET plan = new_plan::plan_type, status = 'active', expires_at = new_expires_at, updated_at = NOW()
    WHERE id = sub_id;
  END IF;

  INSERT INTO public.sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    caller_uid,
    'subscription.updated',
    'subscription',
    sub_id,
    json_build_object('user_id', target_user, 'old_plan', old_plan, 'new_plan', new_plan, 'expires_at', new_expires_at)::jsonb
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

-- 6. Create sys_get_boutiques
CREATE OR REPLACE FUNCTION public.sys_get_boutiques()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '' AS $$
DECLARE v_result JSON;
BEGIN
  IF COALESCE((SELECT role FROM public.profils WHERE id = auth.uid()), '') NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
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
      'gerant_id',        b.gerant_id
    ) ORDER BY b.created_at DESC
  ) INTO v_result FROM public.boutiques b
  WHERE b.deleted_at IS NULL;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- 7. Create sys_list_users
CREATE OR REPLACE FUNCTION public.sys_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role text,
  boutique_id uuid,
  created_at timestamptz,
  boutique_nom text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT p.role INTO caller_role FROM public.profils p WHERE p.id = auth.uid();
  IF COALESCE(caller_role, '') NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    u.email::text,
    (u.raw_user_meta_data->>'full_name')::text as full_name,
    p.role,
    p.boutique_id,
    p.created_at,
    b.nom as boutique_nom
  FROM public.profils p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.boutiques b ON b.id = p.boutique_id
  WHERE p.deleted_at IS NULL
  ORDER BY p.created_at DESC;
END;
$$;

-- 8. Update log trigger on boutiques to use sys_audit_log
CREATE OR REPLACE FUNCTION public.log_boutique_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        INSERT INTO public.sys_audit_log (actor_id, action, target_type, target_id, details)
        VALUES (
            auth.uid(),
            'boutique.deleted',
            'boutique',
            NEW.id,
            jsonb_build_object('nom', NEW.nom)
        );
    END IF;
    RETURN NEW;
END;
$$;

-- 9. Update log trigger on profils to use sys_audit_log
CREATE OR REPLACE FUNCTION public.log_user_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        INSERT INTO public.sys_audit_log (actor_id, action, target_type, target_id, details)
        VALUES (
            auth.uid(),
            'user.deleted',
            'profil',
            NEW.id,
            jsonb_build_object('role', OLD.role)
        );
    END IF;
    RETURN NEW;
END;
$$;

-- 10. Update select policy on sys_audit_log
DROP POLICY IF EXISTS "super_admin_read_audit_log" ON public.sys_audit_log;
CREATE POLICY "super_admin_read_sys_audit_log"
    ON public.sys_audit_log FOR SELECT
    USING (
      COALESCE((SELECT role FROM public.profils WHERE id = auth.uid()), '') IN ('super_admin', 'admin')
    );

-- 11. GRANT ACCESS TO ALL sys_* FUNCTIONS
GRANT EXECUTE ON FUNCTION public.sys_platform_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sys_boutique_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sys_toggle_boutique_suspend(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sys_update_subscription(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sys_get_boutiques() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sys_list_users() TO authenticated;

-- 12. DROP OLD admin_* FUNCTIONS
DROP FUNCTION IF EXISTS public.admin_platform_stats();
DROP FUNCTION IF EXISTS public.admin_boutique_details(uuid);
DROP FUNCTION IF EXISTS public.admin_toggle_boutique_suspend(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.admin_update_subscription(uuid, text, timestamptz);
DROP FUNCTION IF EXISTS public.admin_get_boutiques();
DROP FUNCTION IF EXISTS public.admin_list_users();

-- 13. NOTIFY POSTGREST
NOTIFY pgrst, 'reload schema';
