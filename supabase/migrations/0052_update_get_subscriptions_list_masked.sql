-- Migration 0052: Update get_subscriptions_list_masked and add get_subscription_audit_log

-- 1. Update get_subscriptions_list_masked() to include the new revocation fields from 0050
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
          'revocation_reason', s.revocation_reason,
          'revocation_type',   s.revocation_type,
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

-- 2. Create get_subscription_audit_log RPC to read from subscription_audit_log table
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
          'reason', l.reason,
          'previous_state', l.previous_state,
          'new_state', l.new_state,
          'created_at', l.created_at
        )
        ORDER BY l.created_at DESC
      )
      FROM subscription_audit_log l
      LEFT JOIN auth.users u ON u.id = l.admin_id
      LEFT JOIN profils p ON p.id = l.admin_id
      WHERE l.merchant_id = target_user
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_audit_log(uuid) TO authenticated;
