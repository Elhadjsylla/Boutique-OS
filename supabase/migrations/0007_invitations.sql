-- ================================
-- TABLE INVITATIONS
-- ================================
CREATE TABLE invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'caissier' CHECK (role IN ('caissier', 'gerant')),
  boutique_id  UUID NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  invited_by   UUID NOT NULL REFERENCES auth.users(id),
  token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Gérant/admin voit les invitations de sa boutique
CREATE POLICY "gerant_see_boutique_invitations"
ON invitations FOR SELECT
USING (
  boutique_id IN (
    SELECT boutique_id FROM profils WHERE id = auth.uid()
  )
);

-- Service role gère tout (via Edge Function)
CREATE POLICY "service_role_manage_invitations"
ON invitations FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ================================
-- MISE À JOUR DU TRIGGER handle_new_user
-- Lit boutique_id + role dans raw_user_meta_data si l'user vient d'une invitation
-- Sinon garde la logique bootstrap (3 premiers = super_admin)
-- ================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_count  INTEGER;
  assigned_role   TEXT;
  assigned_boutique UUID;
BEGIN
  -- Utilisateur invité : métadonnées fournies par invite-user
  IF NEW.raw_user_meta_data->>'boutique_id' IS NOT NULL THEN
    assigned_role     := COALESCE(NEW.raw_user_meta_data->>'role', 'caissier');
    assigned_boutique := (NEW.raw_user_meta_data->>'boutique_id')::UUID;

    -- Marquer l'invitation comme acceptée
    UPDATE invitations
    SET status = 'accepted', accepted_at = NOW()
    WHERE email = NEW.email
      AND status = 'pending'
      AND expires_at > NOW();

  ELSE
    -- Logique bootstrap : les 3 premiers comptes = super_admin
    SELECT COUNT(*) INTO existing_count FROM public.profils;
    IF existing_count < 3 THEN
      assigned_role := 'super_admin';
    ELSE
      assigned_role := 'caissier';
    END IF;
    assigned_boutique := NULL;
  END IF;

  INSERT INTO public.profils (id, role, boutique_id)
  VALUES (NEW.id, assigned_role, assigned_boutique)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
