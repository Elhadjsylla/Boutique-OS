-- Migration 0022 : Passage des profils 'admin' à 'super_admin' et attribution de l'abonnement MAX (annual)
BEGIN;

-- 1. Mettre à jour le rôle de tous les administrateurs pour être 'super_admin'
UPDATE public.profils
SET role = 'super_admin'
WHERE role = 'admin';

-- 2. Insérer un abonnement annuel (Plan MAX) pour tous les super_admins qui n'en ont pas d'actif
INSERT INTO public.subscriptions (user_id, plan, status, payment_method, amount, net_amount, starts_at, expires_at)
SELECT
  p.id,
  'annual'::public.plan_type,
  'active'::public.subscription_status,
  'admin'::public.payment_method,
  0,
  0,
  NOW(),
  '2099-12-31 23:59:59+00'::timestamptz
FROM public.profils p
WHERE p.role = 'super_admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p.id
      AND s.status = 'active'
      AND s.expires_at > NOW()
  );

COMMIT;
