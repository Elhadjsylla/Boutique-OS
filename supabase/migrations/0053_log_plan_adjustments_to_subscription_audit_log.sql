-- Migration 0053 : trace les ajustements de plan dans subscription_audit_log
--
-- sys_update_subscription (l'ajustement simple plan/dates, conservé intact —
-- signature et logique métier inchangées) n'écrivait que dans sys_audit_log.
-- Depuis 0052, le dashboard admin lit l'historique par marchand via
-- get_subscription_audit_log(target_user), qui ne lit QUE subscription_audit_log :
-- les ajustements de plan restaient donc invisibles dans cet historique, alors
-- que l'UI affiche déjà un badge "Ajustement" pour action = 'adjust'. Ajout
-- purement additif d'un INSERT supplémentaire, même schéma previous_state/
-- new_state que revoke_subscription/reactivate_subscription (0050).
--
-- Corrige aussi au passage un bug préexistant découvert en testant ce qui
-- précède : `new_plan::plan_type` n'était jamais qualifié par le schéma alors
-- que la fonction tourne avec search_path='', donc Postgres ne pouvait pas
-- résoudre le type — chaque appel (INSERT comme UPDATE) échouait avec
-- "type plan_type does not exist". sys_audit_log ne contient d'ailleurs
-- aucune entrée 'subscription.updated' historique : cette RPC n'avait donc
-- jamais réussi une seule fois en production. Fix : `new_plan::public.plan_type`.
--
-- Deuxième bug trouvé en testant sur un compte réel ayant plusieurs lignes
-- subscriptions (essais de paiement échoués + le vrai abonnement actif) :
-- `ORDER BY created_at DESC LIMIT 1` sans filtrer sur status prenait la ligne
-- la plus récente TOUS statuts confondus, pas la ligne active — un admin
-- ajustant "le" plan d'un marchand pouvait donc modifier une ligne 'failed'
-- orpheline au lieu de son abonnement réellement actif, sans erreur ni
-- avertissement. Fix : priorité à la ligne active si elle existe, sinon
-- comportement inchangé (ligne la plus récente, ou création si aucune).

BEGIN;

CREATE OR REPLACE FUNCTION public.sys_update_subscription(target_user uuid, new_plan text, new_expires_at timestamp with time zone)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller_uid    UUID := auth.uid();
  caller_role   TEXT;
  sub_id        UUID;
  old_plan      TEXT;
  old_status    TEXT;
  old_expires   TIMESTAMPTZ;
  result        JSON;
BEGIN
  SELECT role INTO caller_role FROM public.profils WHERE id = caller_uid;
  IF COALESCE(caller_role, '') NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  IF new_plan NOT IN ('starter', 'pro', 'annual') THEN
    RAISE EXCEPTION 'Plan invalide: %. Valeurs acceptées: starter, pro, annual', new_plan
      USING ERRCODE = '22023';
  END IF;

  SELECT id, plan::text, status::text, expires_at INTO sub_id, old_plan, old_status, old_expires
  FROM public.subscriptions
  WHERE user_id = target_user
  ORDER BY (status = 'active') DESC, created_at DESC
  LIMIT 1;

  IF sub_id IS NULL THEN
    INSERT INTO public.subscriptions (user_id, plan, status, payment_method, amount, net_amount, starts_at, expires_at)
    VALUES (target_user, new_plan::public.plan_type, 'active', 'admin', 0, 0, NOW(), new_expires_at)
    RETURNING id INTO sub_id;
    old_plan := 'aucun';
  ELSE
    UPDATE public.subscriptions
    SET plan = new_plan::public.plan_type, status = 'active', expires_at = new_expires_at, updated_at = NOW()
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

  INSERT INTO public.subscription_audit_log (admin_id, merchant_id, subscription_id, action, reason, previous_state, new_state)
  VALUES (
    caller_uid,
    target_user,
    sub_id,
    'adjust',
    NULL,
    jsonb_build_object('plan', old_plan, 'status', old_status, 'expires_at', old_expires),
    jsonb_build_object('plan', new_plan, 'status', 'active', 'expires_at', new_expires_at)
  );

  SELECT json_build_object(
    'success',         true,
    'subscription_id', sub_id,
    'plan',            new_plan,
    'expires_at',      new_expires_at
  ) INTO result;

  RETURN result;
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
