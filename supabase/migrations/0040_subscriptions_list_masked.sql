-- Migration 0040 : RPC get_subscriptions_list_masked
-- Liste masquée des abonnements pour le dashboard super admin.
-- Réutilise mask_name() et mask_email() de la migration 0037.
-- Reveal via reveal_user_details() existant (tracé dans user_reveal_logs + sys_audit_log).

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
          'created_at',     s.created_at
        )
        ORDER BY s.created_at DESC
      )
      FROM subscriptions s
      JOIN auth.users u ON u.id = s.user_id
      LEFT JOIN profils p ON p.id = s.user_id
      LEFT JOIN boutiques b ON b.id = p.boutique_id
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscriptions_list_masked() TO authenticated;
