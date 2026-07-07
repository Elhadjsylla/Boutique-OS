-- supabase/migrations/0028_update_phone_number_rpc.sql

-- Création d'une fonction RPC pour la mise à jour sécurisée du numéro de téléphone
-- L'utilisateur ne peut modifier que son propre numéro, sans pouvoir altérer son rôle ou sa boutique.

CREATE OR REPLACE FUNCTION public.update_phone_number(new_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  -- Vérification de l'authentification
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  -- Vérification de l'existence du numéro
  IF new_phone IS NULL OR btrim(new_phone) = '' THEN
    RAISE EXCEPTION 'Le numéro de téléphone est obligatoire.';
  END IF;

  -- Validation du format sénégalais (ex: 771234567, 221771234567, +221771234567)
  IF new_phone !~ '^(\+221|221)?7[0-9]{8}$' THEN
    RAISE EXCEPTION 'Numéro invalide — format Sénégal requis (ex: 77XXXXXXX).';
  END IF;

  -- Mise à jour de la table profils uniquement pour l'utilisateur connecté
  UPDATE public.profils
  SET phone_number = btrim(new_phone),
      updated_at = now()
  WHERE id = v_user_id;

  -- Levée d'une erreur si aucune ligne n'a été modifiée (profil introuvable)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil introuvable pour la mise à jour.';
  END IF;
END;
$$;
