-- Migration 0061 : Suppression (soft-delete) d'abonnement par le Super Admin
--
-- Suspendre et annuler existent déjà entièrement depuis 0050/0051
-- (revoke_subscription immediate/end_of_period + reactivate_subscription),
-- avec UI complète dans AdminSubscriptions.tsx, retour garanti au plan Free
-- (_ensure_active_free_subscription) et garde-fou anti-conflit déjà en place
-- côté webhook-unitech (n'active plus que depuis 'pending'). Cette migration
-- n'y touche pas et ajoute uniquement l'action manquante : Supprimer.
--
-- "Supprimer" masque l'abonnement de la liste active du dashboard sans jamais
-- toucher physiquement payment_logs / subscription_audit_log (aucune clause
-- ON DELETE sur leurs FK vers subscriptions.id — un hard delete échouerait de
-- toute façon avec une violation de contrainte tant que ces lignes existent).

BEGIN;

-- ── 1. Colonnes de suppression, même convention que profils.deleted_at /
--       boutiques.deleted_at (0036) plutôt qu'un nouveau schéma parallèle ────
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS deleted_at       timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by       uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deletion_reason  text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_deleted_at ON public.subscriptions(deleted_at);

-- ── 2. subscription_audit_log.action : ajoute 'delete' aux valeurs acceptées ─
ALTER TABLE public.subscription_audit_log DROP CONSTRAINT IF EXISTS subscription_audit_log_action_check;
ALTER TABLE public.subscription_audit_log ADD CONSTRAINT subscription_audit_log_action_check
  CHECK (action IN ('revoke', 'adjust', 'reactivate', 'delete'));

-- ── 3. delete_subscription(subscription_id, reason) ──────────────────────────
-- Si l'abonnement est encore vivant (active/trial), le fait d'abord retomber
-- sur Free en réutilisant _ensure_active_free_subscription (même fonction que
-- revoke_subscription immediate, pas de logique d'accès dupliquée) avant de le
-- marquer supprimé — is_subscription_active()/get_boutique_subscription_status()
-- n'ont donc besoin d'aucune modification : ils excluent déjà tout statut
-- différent de 'active'/'trial', qui ne sera plus jamais vrai pour cette ligne.
CREATE OR REPLACE FUNCTION public.delete_subscription(
  p_subscription_id uuid,
  p_reason          text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_id       uuid := auth.uid();
  v_sub            public.subscriptions%ROWTYPE;
  v_previous_state jsonb;
  v_new_state      jsonb;
  v_free_id        uuid;
BEGIN
  PERFORM public._assert_super_admin();

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Un motif est obligatoire pour supprimer un abonnement';
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement introuvable : %', p_subscription_id;
  END IF;

  IF v_sub.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cet abonnement a déjà été supprimé le %', v_sub.deleted_at;
  END IF;

  v_previous_state := jsonb_build_object(
    'status', v_sub.status, 'plan', v_sub.plan, 'expires_at', v_sub.expires_at
  );

  -- Coupe l'accès si la ligne était encore vivante — même garantie de repli
  -- Free que revoke_subscription('immediate', ...), aucune logique dupliquée.
  IF v_sub.status IN ('active', 'trial') THEN
    UPDATE public.subscriptions
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_subscription_id;

    v_free_id := public._ensure_active_free_subscription(v_sub.user_id);
  END IF;

  UPDATE public.subscriptions
  SET deleted_at      = now(),
      deleted_by      = v_admin_id,
      deletion_reason = btrim(p_reason),
      updated_at      = now()
  WHERE id = p_subscription_id;

  SELECT jsonb_build_object('status', status, 'plan', plan, 'expires_at', expires_at, 'deleted_at', deleted_at)
  INTO v_new_state
  FROM public.subscriptions WHERE id = p_subscription_id;

  INSERT INTO public.subscription_audit_log (admin_id, merchant_id, subscription_id, action, reason, previous_state, new_state)
  VALUES (v_admin_id, v_sub.user_id, p_subscription_id, 'delete', p_reason, v_previous_state, v_new_state);

  INSERT INTO public.sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    v_admin_id, 'subscription.deleted', 'subscription', p_subscription_id,
    jsonb_build_object('merchant_id', v_sub.user_id, 'reason', p_reason, 'free_subscription_id', v_free_id)
  );

  RETURN jsonb_build_object('success', true, 'subscription_id', p_subscription_id, 'free_subscription_id', v_free_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_subscription(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_subscription(uuid, text) TO authenticated;

-- ── 4. get_subscriptions_list_masked() : masque les abonnements supprimés de
--       la liste active (même pattern que get_users_list_masked / deleted_at),
--       masquage nom/email et tous les autres champs inchangés ─────────────
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
      WHERE s.deleted_at IS NULL
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscriptions_list_masked() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
