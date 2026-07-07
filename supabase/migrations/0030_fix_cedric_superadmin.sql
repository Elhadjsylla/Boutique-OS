-- Migration 0030 : Fix définitif du rôle super_admin pour cedricbenoitdieme@gmail.com
-- Contexte : L'utilisateur cedricbenoitdieme@gmail.com ne parvenait pas à accéder
-- au dashboard admin de façon fiable. Ce script garantit que :
--   1. Son profil est bien super_admin dans la table profils
--   2. Il possède un abonnement annual actif jusqu'en 2099
-- Idempotent : peut être ré-exécuté sans danger.

BEGIN;

-- 1. S'assurer que tous les admins connus ont bien le rôle super_admin
UPDATE public.profils
SET role = 'super_admin'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'elhadjsylla667@gmail.com',
    'cedricbenoitdieme@gmail.com',
    'gmoustapha0805@gmail.com'
  )
)
AND role <> 'super_admin';

-- 2. Attribuer un abonnement annual (Plan MAX) à cedricbenoitdieme si absent
INSERT INTO public.subscriptions (user_id, plan, status, payment_method, amount, net_amount, starts_at, expires_at)
SELECT
  u.id,
  'annual'::public.plan_type,
  'active'::public.subscription_status,
  'admin'::public.payment_method,
  0,
  0,
  NOW(),
  '2099-12-31 23:59:59+00'::timestamptz
FROM auth.users u
WHERE u.email = 'cedricbenoitdieme@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = u.id
      AND s.status = 'active'
      AND s.expires_at > NOW()
  );

-- 3. Même chose pour tous les super_admins sans abonnement actif
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

-- 4. Verification finale
DO $$
DECLARE
  cedric_role text;
  cedric_sub_count int;
BEGIN
  SELECT p.role INTO cedric_role
  FROM public.profils p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = 'cedricbenoitdieme@gmail.com';

  SELECT COUNT(*) INTO cedric_sub_count
  FROM public.subscriptions s
  JOIN auth.users u ON u.id = s.user_id
  WHERE u.email = 'cedricbenoitdieme@gmail.com'
    AND s.status = 'active'
    AND s.expires_at > NOW();

  RAISE NOTICE '[0030] cedricbenoitdieme@gmail.com - role: %, active_subs: %', cedric_role, cedric_sub_count;

  IF cedric_role <> 'super_admin' THEN
    RAISE EXCEPTION '[0030] ERREUR: cedric n a pas le role super_admin!';
  END IF;
END;
$$;

COMMIT;
