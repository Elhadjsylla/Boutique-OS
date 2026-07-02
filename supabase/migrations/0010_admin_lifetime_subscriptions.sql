-- Abonnement lifetime pour les super_admins existants
INSERT INTO subscriptions (user_id, plan, status, payment_method, amount, net_amount, starts_at, expires_at)
SELECT
  p.id,
  'annual',
  'active',
  'admin',
  0,
  0,
  NOW(),
  '2099-12-31 23:59:59+00'::timestamptz
FROM profils p
WHERE p.role = 'super_admin'
ON CONFLICT DO NOTHING;

-- Trigger mis à jour : super_admin reçoit automatiquement un abo lifetime
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_count    INTEGER;
  assigned_role     TEXT;
  assigned_boutique UUID;
BEGIN
  -- Utilisateur invité via invite-user
  IF NEW.raw_user_meta_data->>'boutique_id' IS NOT NULL THEN
    assigned_role     := COALESCE(NEW.raw_user_meta_data->>'role', 'caissier');
    assigned_boutique := (NEW.raw_user_meta_data->>'boutique_id')::UUID;

    UPDATE invitations
    SET status = 'accepted', accepted_at = NOW()
    WHERE email = NEW.email
      AND status = 'pending'
      AND expires_at > NOW();

  ELSE
    -- Bootstrap : les 3 premiers = super_admin
    SELECT COUNT(*) INTO existing_count FROM public.profils;
    IF existing_count < 3 THEN
      assigned_role := 'super_admin';
    ELSE
      assigned_role := 'caissier';
    END IF;
    assigned_boutique := NULL;
  END IF;

  -- Créer le profil
  INSERT INTO public.profils (id, role, boutique_id)
  VALUES (NEW.id, assigned_role, assigned_boutique)
  ON CONFLICT (id) DO NOTHING;

  -- super_admin → abonnement lifetime gratuit automatique
  IF assigned_role = 'super_admin' THEN
    INSERT INTO subscriptions (user_id, plan, status, payment_method, amount, net_amount, starts_at, expires_at)
    VALUES (NEW.id, 'annual', 'active', 'admin', 0, 0, NOW(), '2099-12-31 23:59:59+00')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
