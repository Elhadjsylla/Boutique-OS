-- Migration 0046 : Fixe le search_path des fonctions qui ne le déclaraient pas explicitement
-- Objectif : empêcher un search_path hijacking (une fonction sans search_path fixe peut être
-- trompée par un objet malveillant placé plus tôt dans le search_path de l'appelant).
-- Ne change aucune logique métier — seulement la configuration de résolution des noms.

BEGIN;

ALTER FUNCTION public._set_subscription_cancelled_at() SET search_path = public;
ALTER FUNCTION public.cancel_free_trial() SET search_path = public;
ALTER FUNCTION public.check_quota(p_quota_type text) SET search_path = public;
ALTER FUNCTION public.check_stock_alert() SET search_path = public;
ALTER FUNCTION public.decrement_stock_on_sale() SET search_path = public;
ALTER FUNCTION public.expire_subscriptions() SET search_path = public;
ALTER FUNCTION public.get_trial_status() SET search_path = public;
ALTER FUNCTION public.get_user_plan_and_limits() SET search_path = public;
ALTER FUNCTION public.is_subscription_active() SET search_path = public;
ALTER FUNCTION public.log_boutique_deletion() SET search_path = public;
ALTER FUNCTION public.log_user_deletion() SET search_path = public;
ALTER FUNCTION public.notify_expiring_subscriptions() SET search_path = public;
ALTER FUNCTION public.set_current_timestamp_updated_at() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.start_free_trial(p_plan text) SET search_path = public;
ALTER FUNCTION public.update_phone_number(new_phone text) SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;

COMMIT;
