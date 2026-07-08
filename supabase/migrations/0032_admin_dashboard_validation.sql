-- Migration 0032 : RPCs Validation des comptes (Section A)
-- get_users_pending_validation / get_user_full_details / approve_user / reject_user

BEGIN;

-- ══════════════════════════════════════════════════════════════
-- HELPER : vérification super_admin (réutilisé dans toutes les RPCs admin)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public._assert_super_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT role FROM profils WHERE id = auth.uid()) IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Accès refusé — super_admin requis'
      USING DETAIL = 'L''utilisateur appelant n''a pas le rôle super_admin.',
            HINT   = '403';
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- A1. get_users_pending_validation()
-- Retourne les comptes en attente avec données masquées.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_users_pending_validation()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  PERFORM _assert_super_admin();

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                p.id,
          'nom',               COALESCE(p.nom, split_part(u.email, '@', 1)),
          'prenom',            COALESCE(p.prenom, ''),
          'email_masque',
            SUBSTRING(u.email, 1, 2) || '****@'
            || SUBSTRING(u.email, POSITION('@' IN u.email) + 1),
          'telephone_masque',
            CASE
              WHEN p.phone_number IS NULL THEN NULL
              ELSE
                SUBSTRING(REGEXP_REPLACE(p.phone_number, '^\+?221', ''), 1, 2)
                || '****'
                || RIGHT(p.phone_number, 2)
            END,
          'created_at',        p.created_at,
          'role_demande',      p.role,
          'boutique_nom',      b.nom
        )
        ORDER BY p.created_at ASC
      )
      FROM profils p
      JOIN auth.users u ON u.id = p.id
      LEFT JOIN boutiques b ON b.id = p.boutique_id
      WHERE p.status = 'pending'
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_pending_validation() TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- A2. get_user_full_details(user_id)
-- Toutes les infos en clair. Super_admin uniquement.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_user_full_details(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM _assert_super_admin();

  SELECT jsonb_build_object(
    'id',             p.id,
    'nom',            p.nom,
    'prenom',         p.prenom,
    'email',          u.email,
    'phone_number',   p.phone_number,
    'role',           p.role,
    'status',         p.status,
    'boutique_id',    p.boutique_id,
    'boutique_nom',   b.nom,
    'boutique_adresse', b.adresse,
    'boutique_quartier', b.quartier,
    'created_at',     p.created_at,
    'updated_at',     p.updated_at,
    'rejected_at',    p.rejected_at,
    'rejected_reason', p.rejected_reason,
    'subscriptions',  COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'plan', s.plan::TEXT,
          'status', s.status::TEXT,
          'starts_at', s.starts_at,
          'expires_at', s.expires_at,
          'payment_method', s.payment_method::TEXT,
          'amount', s.amount
        ) ORDER BY s.created_at DESC
      ) FROM subscriptions s WHERE s.user_id = p.id),
      '[]'::jsonb
    ),
    'nb_ventes', (
      SELECT COUNT(*) FROM ventes v
      JOIN boutiques b2 ON b2.id = v.boutique_id
      WHERE b2.gerant_id = p.id
    )
  )
  INTO v_result
  FROM profils p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN boutiques b ON b.id = p.boutique_id
  WHERE p.id = p_user_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable : %', p_user_id;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_full_details(UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- A3. approve_user(user_id)
-- Passe le statut à 'active' et log dans admin_audit_log.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.approve_user(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _assert_super_admin();

  UPDATE profils
  SET status = 'active', updated_at = NOW()
  WHERE id = p_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Compte non trouvé ou déjà traité'
    );
  END IF;

  -- Log audit
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'approve_user', 'user', p_user_id, '{}');

  -- Notification à l'utilisateur
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    p_user_id,
    'account_approved',
    'Compte approuvé !',
    'Votre compte Sama Boutik a été validé. Vous pouvez maintenant accéder à toutes les fonctionnalités.'
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_user(UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- A4. reject_user(user_id, raison)
-- Passe le statut à 'rejected', log la raison.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reject_user(p_user_id UUID, p_raison TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _assert_super_admin();

  UPDATE profils
  SET status          = 'rejected',
      rejected_at     = NOW(),
      rejected_reason = p_raison,
      updated_at      = NOW()
  WHERE id = p_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Compte non trouvé ou déjà traité'
    );
  END IF;

  -- Log audit
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'reject_user', 'user', p_user_id,
    jsonb_build_object('raison', p_raison));

  -- Notification à l'utilisateur
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    p_user_id,
    'account_rejected',
    'Compte non approuvé',
    COALESCE(
      'Votre demande n''a pas été approuvée. Raison : ' || p_raison,
      'Votre demande d''inscription n''a pas été approuvée. Contactez le support pour plus d''informations.'
    )
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'raison', p_raison);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_user(UUID, TEXT) TO authenticated;

COMMIT;
