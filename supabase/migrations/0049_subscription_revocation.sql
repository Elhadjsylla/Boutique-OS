-- Migration 0049: Subscription Revocation and Reactivation

-- 1. Add revocation metadata columns to public.subscriptions
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id);
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS revoked_reason TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS revoked_type TEXT; -- 'immediate' | 'delayed'
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS revoked_previous_plan TEXT;

-- 2. Update get_subscriptions_list_masked() to include the new revocation fields
CREATE OR REPLACE FUNCTION public.get_subscriptions_list_masked()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM _assert_super_admin();

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',             s.id,
          'user_id',        s.user_id,
          'nom_masque',     mask_name(
                              CASE
                                WHEN TRIM(COALESCE(p.prenom, '') || ' ' || COALESCE(p.nom, '')) <> ''
                                THEN TRIM(COALESCE(p.prenom, '') || ' ' || COALESCE(p.nom, ''))
                                ELSE SPLIT_PART(u.email, '@', 1)
                              END
                            ),
          'email_masque',   mask_email(u.email),
          'boutique_nom',   b.nom,
          'plan',           s.plan::TEXT,
          'status',         s.status::TEXT,
          'payment_method', s.payment_method::TEXT,
          'amount',         s.amount,
          'net_amount',     s.net_amount,
          'is_trial',       s.is_trial,
          'starts_at',      s.starts_at,
          'expires_at',     s.expires_at,
          'confirmed_at',   s.confirmed_at,
          'cancelled_at',   s.cancelled_at,
          'created_at',     s.created_at,
          'revoked_at',     s.revoked_at,
          'revoked_by',     s.revoked_by,
          'revoked_reason', s.revoked_reason,
          'revoked_type',   s.revoked_type,
          'revoked_by_name', COALESCE(admin_p.prenom || ' ' || admin_p.nom, admin_u.email, 'Admin')
        )
        ORDER BY s.created_at DESC
      )
      FROM subscriptions s
      JOIN auth.users u ON u.id = s.user_id
      LEFT JOIN profils p ON p.id = s.user_id
      LEFT JOIN boutiques b ON b.id = p.boutique_id
      LEFT JOIN auth.users admin_u ON admin_u.id = s.revoked_by
      LEFT JOIN profils admin_p ON admin_p.id = s.revoked_by
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscriptions_list_masked() TO authenticated;

-- 3. Update get_boutique_subscription_status to support delayed cancellations
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
    'actif', COALESCE((s.status = 'active' OR (s.status = 'cancelled' AND s.revoked_type = 'delayed')) AND s.expires_at > now(), false),
    'plan', s.plan,
    'date_fin', s.expires_at
  )
  INTO v_result
  FROM boutiques b
  LEFT JOIN LATERAL (
    SELECT plan, status, expires_at, revoked_type
    FROM subscriptions
    WHERE user_id = b.gerant_id
    ORDER BY expires_at DESC NULLS LAST
    LIMIT 1
  ) s ON true
  WHERE b.id = p_boutique_id;

  RETURN COALESCE(v_result, jsonb_build_object('actif', false, 'plan', null, 'date_fin', null));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_boutique_subscription_status(uuid) TO authenticated;

-- 4. Update get_user_plan_and_limits to support delayed cancellations
CREATE OR REPLACE FUNCTION public.get_user_plan_and_limits()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    AND (status = 'active' OR status = 'trial' OR (status = 'cancelled' AND revoked_type = 'delayed'))
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

GRANT EXECUTE ON FUNCTION public.get_user_plan_and_limits() TO authenticated;

-- 5. Create sys_revoke_subscription RPC
CREATE OR REPLACE FUNCTION public.sys_revoke_subscription(target_user uuid, revoke_type text, reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id      UUID;
  v_old_plan    TEXT;
  v_old_status  TEXT;
  v_expires_at  TIMESTAMPTZ;
  result        JSON;
BEGIN
  PERFORM _assert_super_admin();

  IF revoke_type NOT IN ('immediate', 'delayed') THEN
    RAISE EXCEPTION 'Type de révocation invalide: %. Attendu: immediate, delayed', revoke_type;
  END IF;

  IF reason IS NULL OR TRIM(reason) = '' THEN
    RAISE EXCEPTION 'Le motif de la révocation est obligatoire.';
  END IF;

  SELECT id, plan::text, status::text, expires_at
  INTO v_sub_id, v_old_plan, v_old_status, v_expires_at
  FROM public.subscriptions
  WHERE user_id = target_user
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'Aucun abonnement trouvé pour cet utilisateur.';
  END IF;

  IF revoke_type = 'immediate' THEN
    UPDATE public.subscriptions
    SET plan = 'free'::plan_type,
        status = 'cancelled'::subscription_status,
        expires_at = '2099-12-31 23:59:59+00'::timestamptz,
        revoked_at = NOW(),
        revoked_by = auth.uid(),
        revoked_reason = reason,
        revoked_type = 'immediate',
        revoked_previous_plan = v_old_plan,
        updated_at = NOW()
    WHERE id = v_sub_id;
  ELSE
    UPDATE public.subscriptions
    SET status = 'cancelled'::subscription_status,
        revoked_at = NOW(),
        revoked_by = auth.uid(),
        revoked_reason = reason,
        revoked_type = 'delayed',
        revoked_previous_plan = v_old_plan,
        updated_at = NOW()
    WHERE id = v_sub_id;
  END IF;

  INSERT INTO public.sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'subscription.revoked',
    'user',
    target_user,
    json_build_object(
      'sub_id', v_sub_id,
      'old_plan', v_old_plan,
      'revoke_type', revoke_type,
      'reason', reason
    )
  );

  SELECT json_build_object('success', true, 'sub_id', v_sub_id) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sys_revoke_subscription(uuid, text, text) TO authenticated;

-- 6. Create sys_reactivate_subscription RPC
CREATE OR REPLACE FUNCTION public.sys_reactivate_subscription(target_user uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id      UUID;
  v_prev_plan   TEXT;
  v_rev_type    TEXT;
  v_expires_at  TIMESTAMPTZ;
  v_new_exp     TIMESTAMPTZ;
  v_target_plan plan_type;
  result        JSON;
BEGIN
  PERFORM _assert_super_admin();

  SELECT id, revoked_previous_plan, revoked_type, expires_at
  INTO v_sub_id, v_prev_plan, v_rev_type, v_expires_at
  FROM public.subscriptions
  WHERE user_id = target_user
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'Aucun abonnement trouvé pour cet utilisateur.';
  END IF;

  v_target_plan := COALESCE(v_prev_plan, 'starter')::plan_type;
  
  -- If immediate was used, plan is free. We give them 30 days or restore their previous duration.
  -- If delayed was used, we restore status to active.
  IF v_rev_type = 'immediate' THEN
    v_new_exp := CASE WHEN v_expires_at < NOW() OR v_expires_at = '2099-12-31 23:59:59+00'::timestamptz 
                      THEN NOW() + INTERVAL '30 days' 
                      ELSE v_expires_at END;
  ELSE
    v_new_exp := CASE WHEN v_expires_at < NOW() THEN NOW() + INTERVAL '30 days' ELSE v_expires_at END;
  END IF;

  UPDATE public.subscriptions
  SET plan = v_target_plan,
      status = 'active'::subscription_status,
      expires_at = v_new_exp,
      revoked_at = NULL,
      revoked_by = NULL,
      revoked_reason = NULL,
      revoked_type = NULL,
      revoked_previous_plan = NULL,
      updated_at = NOW()
  WHERE id = v_sub_id;

  INSERT INTO public.sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'subscription.reactivated',
    'user',
    target_user,
    json_build_object(
      'sub_id', v_sub_id,
      'restored_plan', v_target_plan::TEXT
    )
  );

  SELECT json_build_object('success', true, 'sub_id', v_sub_id) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sys_reactivate_subscription(uuid) TO authenticated;

-- 7. Create get_subscription_audit_log RPC
CREATE OR REPLACE FUNCTION public.get_subscription_audit_log(target_user uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  PERFORM _assert_super_admin();

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'actor_email', u.email,
          'actor_name', COALESCE(p.prenom || ' ' || p.nom, u.email, 'Admin'),
          'action', l.action,
          'created_at', l.created_at,
          'details', l.details
        )
        ORDER BY l.created_at DESC
      )
      FROM sys_audit_log l
      LEFT JOIN auth.users u ON u.id = l.actor_id
      LEFT JOIN profils p ON p.id = l.actor_id
      WHERE l.target_type = 'user' AND l.target_id = target_user
        AND l.action IN ('subscription.updated', 'subscription.revoked', 'subscription.reactivated')
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_audit_log(uuid) TO authenticated;
