-- Migration 0038 : Fix colonne actor_id sur sys_audit_log
-- Problème : la table sys_audit_log avait la colonne "admin_id" (nom d'origine),
-- mais toutes les fonctions récentes (0032, 0037, invite-user) écrivaient "actor_id".
-- Fix : renommer admin_id → actor_id + corriger approve_user/reject_user
-- qui pointaient encore sur l'ancien nom de table admin_audit_log.

BEGIN;

-- 1. Renommer la colonne
ALTER TABLE public.sys_audit_log
  RENAME COLUMN admin_id TO actor_id;

ALTER INDEX IF EXISTS idx_sys_audit_log_admin_id RENAME TO idx_sys_audit_log_actor_id;

-- 2. approve_user : admin_audit_log(admin_id) → sys_audit_log(actor_id)
CREATE OR REPLACE FUNCTION public.approve_user(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _assert_super_admin();

  UPDATE profils
  SET status = 'active', updated_at = NOW()
  WHERE id = p_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compte non trouvé ou déjà traité');
  END IF;

  INSERT INTO sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'approve_user', 'user', p_user_id, '{}');

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

-- 3. reject_user : admin_audit_log(admin_id) → sys_audit_log(actor_id)
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
    RETURN jsonb_build_object('success', false, 'error', 'Compte non trouvé ou déjà traité');
  END IF;

  INSERT INTO sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'reject_user', 'user', p_user_id,
    jsonb_build_object('raison', p_raison));

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

NOTIFY pgrst, 'reload schema';

COMMIT;
