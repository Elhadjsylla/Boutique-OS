
-- ================================
-- BOUTIKOS — CLIENT ACCOUNTS
-- Compte client final (débiteur)
-- ================================

-- 1. Table client_accounts (séparée de profils — les clients ne sont pas des marchands)
CREATE TABLE IF NOT EXISTS public.client_accounts (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_see_own_account"
  ON public.client_accounts FOR SELECT USING (auth.uid() = id);

-- 2. Colonne client_id sur ardoises (lien entre ardoise et compte client)
ALTER TABLE public.ardoises
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ardoises_client_id ON public.ardoises(client_id);

-- 3. Modifier handle_new_user pour distinguer client vs marchand
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF new.raw_user_meta_data->>'user_type' = 'client' THEN
    INSERT INTO public.client_accounts (id, email)
    VALUES (new.id, new.email)
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO public.profils (id, role, boutique_id)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'role', 'caissier'),
      CASE
        WHEN new.raw_user_meta_data->>'boutique_id' IS NOT NULL
        THEN (new.raw_user_meta_data->>'boutique_id')::uuid
        ELSE NULL
      END
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN new;
END;
$$;

-- 4. RPC claim_ardoise — lie un access_token d'ardoise au client connecté
CREATE OR REPLACE FUNCTION public.claim_ardoise(p_token UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ardoise_id UUID;
BEGIN
  SELECT id INTO v_ardoise_id
  FROM public.ardoises
  WHERE access_token = p_token
    AND (client_id IS NULL OR client_id = auth.uid());

  IF v_ardoise_id IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'not_found_or_claimed');
  END IF;

  UPDATE public.ardoises
  SET client_id = auth.uid()
  WHERE id = v_ardoise_id;

  RETURN json_build_object('success', true, 'ardoise_id', v_ardoise_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_ardoise(UUID) TO authenticated;

-- 5. RPC get_my_ardoises_as_client — toutes les ardoises liées au client connecté
CREATE OR REPLACE FUNCTION public.get_my_ardoises_as_client()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'ardoise', row_to_json(a.*),
      'boutique_nom', b.nom,
      'paiements', COALESCE(
        (SELECT json_agg(p ORDER BY p.paid_at DESC)
         FROM public.ardoise_paiements p WHERE p.ardoise_id = a.id),
        '[]'::json
      )
    ) ORDER BY a.updated_at DESC
  ) INTO v_result
  FROM public.ardoises a
  JOIN public.boutiques b ON b.id = a.boutique_id
  WHERE a.client_id = auth.uid();

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_ardoises_as_client() TO authenticated;
