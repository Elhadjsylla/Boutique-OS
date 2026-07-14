-- Migration 0050 : révocation d'abonnement par le Super Admin
--
-- Ajoute une révocation complète et distincte du simple ajustement de plan
-- (sys_update_subscription, conservé tel quel) : deux modes (immédiat / fin de
-- période), traçabilité dédiée (subscription_audit_log), et retour cohérent vers
-- le plan Free perpétuel déjà posé à l'inscription (handle_new_user, 0026) plutôt
-- qu'une coupure en dur.

-- ── 1. Enum : ajout de 'suspended' (transaction séparée, requis par Postgres
--       avant de pouvoir utiliser la nouvelle valeur plus bas) ─────────────────
BEGIN;
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'suspended';
COMMIT;

BEGIN;

-- ── 2. Colonnes de révocation sur subscriptions ─────────────────────────────
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS revoked_at        timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by        uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revocation_reason text,
  ADD COLUMN IF NOT EXISTS revocation_type   text CHECK (revocation_type IN ('immediate', 'end_of_period'));

-- ── 3. Table d'audit dédiée ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NOT NULL REFERENCES auth.users(id),
  merchant_id     uuid NOT NULL REFERENCES auth.users(id),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id),
  action          text NOT NULL CHECK (action IN ('revoke', 'adjust', 'reactivate')),
  reason          text,
  previous_state  jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_state       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Même schéma de policies que sys_audit_log / user_reveal_logs : écriture
-- réservée au service_role (donc, en pratique, aux fonctions SECURITY DEFINER
-- ci-dessous qui s'exécutent avec les droits du propriétaire), lecture réservée
-- au super_admin, aucune écriture directe via PostgREST.
CREATE POLICY "service_role_manage_subscription_audit_log"
ON public.subscription_audit_log FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "super_admin_read_subscription_audit_log"
ON public.subscription_audit_log FOR SELECT
USING (public.get_my_role() = 'super_admin');

CREATE POLICY "no_direct_insert_subscription_audit_log"
ON public.subscription_audit_log FOR INSERT
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_subscription_audit_log_merchant
  ON public.subscription_audit_log (merchant_id, created_at DESC);

-- ── 4. Helpers internes ──────────────────────────────────────────────────────
-- Préfixés `_` par convention (voir _assert_super_admin) : privés, exécution
-- révoquée à anon/authenticated plus bas, appelables uniquement depuis une autre
-- fonction SECURITY DEFINER de ce fichier. Sans ce verrou, n'importe quel
-- utilisateur authentifié pourrait appeler _ensure_active_free_subscription()
-- avec le user_id d'un tiers et rétrograder de force son abonnement.

-- Désactive (status -> 'expired') toutes les autres lignes actives d'un
-- utilisateur, pour garantir l'invariant "une seule ligne active à la fois" déjà
-- respecté par le webhook de paiement (payment_completed expire l'ancien plan
-- actif lors d'un renouvellement/upgrade confirmé).
CREATE OR REPLACE FUNCTION public._deactivate_other_active_subscriptions(p_user_id uuid, p_keep_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired', updated_at = now()
  WHERE user_id = p_user_id
    AND status = 'active'
    AND id <> p_keep_id;
END;
$$;

-- Garantit qu'un utilisateur a une ligne 'free' active (créée si absente,
-- réactivée si expirée) et redevient donc la seule ligne active — cohérent avec
-- le plan Free perpétuel déjà posé à l'inscription (handle_new_user, 0026),
-- plutôt qu'une simple coupure d'accès en dur.
CREATE OR REPLACE FUNCTION public._ensure_active_free_subscription(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_free_id uuid;
BEGIN
  SELECT id INTO v_free_id
  FROM public.subscriptions
  WHERE user_id = p_user_id AND plan = 'free'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_free_id IS NULL THEN
    INSERT INTO public.subscriptions (
      user_id, plan, status, payment_method, amount, net_amount, is_trial, starts_at, expires_at
    )
    VALUES (p_user_id, 'free', 'active', 'admin', 0, 0, false, now(), '2099-12-31 23:59:59+00'::timestamptz)
    RETURNING id INTO v_free_id;
  ELSE
    UPDATE public.subscriptions
    SET status = 'active',
        expires_at = '2099-12-31 23:59:59+00'::timestamptz,
        updated_at = now()
    WHERE id = v_free_id;
  END IF;

  PERFORM public._deactivate_other_active_subscriptions(p_user_id, v_free_id);

  RETURN v_free_id;
END;
$$;

-- ── 5. revoke_subscription ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_subscription(
  p_subscription_id uuid,
  p_reason          text,
  p_revocation_type text
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

  IF p_revocation_type NOT IN ('immediate', 'end_of_period') THEN
    RAISE EXCEPTION 'revocation_type invalide : % (attendu immediate ou end_of_period)', p_revocation_type;
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Un motif est obligatoire pour révoquer un abonnement';
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement introuvable : %', p_subscription_id;
  END IF;

  IF v_sub.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cet abonnement a déjà été révoqué le %', v_sub.revoked_at;
  END IF;

  v_previous_state := jsonb_build_object(
    'status', v_sub.status, 'plan', v_sub.plan, 'expires_at', v_sub.expires_at
  );

  -- Annule tout paiement en cours (checkout non confirmé) pour ce marchand, pour
  -- qu'un webhook de confirmation tardif ne puisse pas réactiver l'accès en douce.
  -- Voir aussi le garde-fou symétrique côté webhook-unitech : il n'active plus
  -- que depuis le statut 'pending', jamais depuis 'cancelled'/'suspended'.
  UPDATE public.subscriptions
  SET status = 'cancelled', updated_at = now()
  WHERE user_id = v_sub.user_id
    AND status = 'pending'
    AND id <> p_subscription_id;

  UPDATE public.subscriptions
  SET revoked_at        = now(),
      revoked_by        = v_admin_id,
      revocation_reason = p_reason,
      revocation_type   = p_revocation_type,
      status = CASE WHEN p_revocation_type = 'immediate' THEN 'suspended'::public.subscription_status ELSE status END,
      updated_at = now()
  WHERE id = p_subscription_id;

  -- Immédiat : coupe l'accès premium tout de suite et retombe sur le plan Free.
  -- Fin de période : le marchand garde l'accès jusqu'à expires_at déjà payé ;
  -- voir expire_subscriptions() plus bas pour la bascule automatique différée.
  IF p_revocation_type = 'immediate' THEN
    v_free_id := public._ensure_active_free_subscription(v_sub.user_id);
  END IF;

  SELECT jsonb_build_object('status', status, 'plan', plan, 'expires_at', expires_at,
                             'revocation_type', revocation_type, 'revoked_at', revoked_at)
  INTO v_new_state
  FROM public.subscriptions WHERE id = p_subscription_id;

  INSERT INTO public.subscription_audit_log (admin_id, merchant_id, subscription_id, action, reason, previous_state, new_state)
  VALUES (v_admin_id, v_sub.user_id, p_subscription_id, 'revoke', p_reason, v_previous_state, v_new_state);

  INSERT INTO public.sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    v_admin_id, 'subscription.revoked', 'subscription', p_subscription_id,
    jsonb_build_object(
      'merchant_id', v_sub.user_id,
      'revocation_type', p_revocation_type,
      'reason', p_reason,
      'free_subscription_id', v_free_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', p_subscription_id,
    'revocation_type', p_revocation_type,
    'free_subscription_id', v_free_id
  );
END;
$$;

-- ── 6. reactivate_subscription ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reactivate_subscription(p_subscription_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_id        uuid := auth.uid();
  v_sub             public.subscriptions%ROWTYPE;
  v_previous_state  jsonb;
  v_new_state       jsonb;
  v_restored_status public.subscription_status;
BEGIN
  PERFORM public._assert_super_admin();

  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement introuvable : %', p_subscription_id;
  END IF;

  IF v_sub.revoked_at IS NULL THEN
    RAISE EXCEPTION 'Cet abonnement n''a pas été révoqué, rien à réactiver';
  END IF;

  v_previous_state := jsonb_build_object(
    'status', v_sub.status, 'plan', v_sub.plan, 'expires_at', v_sub.expires_at,
    'revocation_type', v_sub.revocation_type
  );

  -- Ne ressuscite pas un abonnement déjà naturellement expiré entre-temps
  -- (ex : révocation "fin de période" dont l'échéance est passée depuis).
  v_restored_status := CASE
    WHEN v_sub.expires_at > now() THEN 'active'::public.subscription_status
    ELSE 'expired'::public.subscription_status
  END;

  UPDATE public.subscriptions
  SET status            = v_restored_status,
      revoked_at        = NULL,
      revoked_by        = NULL,
      revocation_reason = NULL,
      revocation_type   = NULL,
      updated_at        = now()
  WHERE id = p_subscription_id;

  -- Redevient la seule ligne active si la réactivation restaure un accès réel
  -- (sinon on laisse un éventuel plan Free de secours actif, cf. immediate revoke).
  IF v_restored_status = 'active' THEN
    PERFORM public._deactivate_other_active_subscriptions(v_sub.user_id, p_subscription_id);
  END IF;

  SELECT jsonb_build_object('status', status, 'plan', plan, 'expires_at', expires_at)
  INTO v_new_state
  FROM public.subscriptions WHERE id = p_subscription_id;

  INSERT INTO public.subscription_audit_log (admin_id, merchant_id, subscription_id, action, reason, previous_state, new_state)
  VALUES (v_admin_id, v_sub.user_id, p_subscription_id, 'reactivate', NULL, v_previous_state, v_new_state);

  INSERT INTO public.sys_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    v_admin_id, 'subscription.reactivated', 'subscription', p_subscription_id,
    jsonb_build_object('merchant_id', v_sub.user_id, 'restored_status', v_restored_status)
  );

  RETURN jsonb_build_object('success', true, 'subscription_id', p_subscription_id, 'status', v_restored_status);
END;
$$;

-- ── 7. expire_subscriptions : bascule auto vers Free pour les révocations
--       "fin de période" une fois l'échéance déjà payée atteinte. Le comportement
--       existant (expiration naturelle non révoquée -> juste 'expired', paywall
--       dur) est inchangé : ce n'est pas l'objet de cette migration. ───────────
CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_count INT;
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, user_id
    FROM subscriptions
    WHERE status = 'active'
      AND expires_at < NOW()
      AND revocation_type = 'end_of_period'
      AND revoked_at IS NOT NULL
  LOOP
    UPDATE subscriptions SET status = 'expired', updated_at = now() WHERE id = r.id;
    PERFORM public._ensure_active_free_subscription(r.user_id);
  END LOOP;

  UPDATE subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  IF expired_count > 0 THEN
    RAISE LOG 'expire_subscriptions: % abonnement(s) expiré(s)', expired_count;
  END IF;
END;
$$;

-- ── 8. Sécurité ───────────────────────────────────────────────────────────────
-- Les deux RPC publiques restent appelables par n'importe quel utilisateur
-- authentifié (comme le reste des RPC admin de ce projet, ex. sys_update_subscription,
-- reveal_user_details) : c'est le PERFORM _assert_super_admin() dans le corps qui
-- fait office de verrou applicatif. Le verrou RLS, lui, est déjà en place sur la
-- table subscriptions elle-même (aucune policy INSERT/UPDATE pour authenticated —
-- voir pg_policies), donc toute tentative d'écriture directe hors RPC est bloquée
-- par Postgres avant même d'atteindre une fonction.
REVOKE EXECUTE ON FUNCTION public.revoke_subscription(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reactivate_subscription(uuid) FROM anon;

-- Les helpers privés, eux, n'ont aucun garde-fou interne (pas d'_assert_super_admin) :
-- ils font confiance à leur appelant. Sans ce verrou, n'importe quel utilisateur
-- authentifié pourrait les invoquer directement via supabase.rpc(...) avec le
-- user_id d'un tiers et lui rétrograder de force son abonnement vers Free.
REVOKE EXECUTE ON FUNCTION public._ensure_active_free_subscription(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._deactivate_other_active_subscriptions(uuid, uuid) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
