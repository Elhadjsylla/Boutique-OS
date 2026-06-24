
-- Fix: all admin functions were checking auth.jwt() ->> 'role' which always returns
-- 'authenticated' in Supabase, never 'super_admin'. Replace with profils table lookup.

-- 1. admin_platform_stats
CREATE OR REPLACE FUNCTION public.admin_platform_stats()
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

-- 2. admin_boutique_details
CREATE OR REPLACE FUNCTION public.admin_boutique_details(boutique_uuid uuid)
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
  IF COALESCE(caller_role, '') <> 'super_admin' THEN
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

-- 3. admin_toggle_boutique_suspend
CREATE OR REPLACE FUNCTION public.admin_toggle_boutique_suspend(boutique_uuid uuid, suspend boolean, reason text DEFAULT NULL)
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

-- 4. admin_update_subscription
CREATE OR REPLACE FUNCTION public.admin_update_subscription(target_user uuid, new_plan text, new_expires_at timestamptz)
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
  IF COALESCE(caller_role, '') <> 'super_admin' THEN
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

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, details)
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

-- 5. assign_staff — read role and boutique_id from profils, not JWT
CREATE OR REPLACE FUNCTION public.assign_staff(target_user uuid, new_role text, new_boutique uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  caller_role     TEXT;
  caller_boutique UUID;
BEGIN
  SELECT role, boutique_id INTO caller_role, caller_boutique
  FROM public.profils WHERE id = auth.uid();

  IF new_role NOT IN ('caissier', 'gerant', 'super_admin') THEN
    RAISE EXCEPTION 'Role invalide: %', new_role USING ERRCODE = '22023';
  END IF;

  IF caller_role = 'super_admin' THEN
    NULL;

  ELSIF caller_role = 'gerant' THEN
    IF new_role = 'super_admin' THEN
      RAISE EXCEPTION 'Un gerant ne peut pas créer de super_admin' USING ERRCODE = '42501';
    END IF;
    IF new_boutique IS DISTINCT FROM caller_boutique THEN
      RAISE EXCEPTION 'Un gerant ne peut affecter que sa propre boutique' USING ERRCODE = '42501';
    END IF;

  ELSE
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profils
  SET role = new_role, boutique_id = new_boutique
  WHERE id = target_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable: %', target_user USING ERRCODE = 'P0002';
  END IF;
END;
$$;
