-- supabase/migrations/0029_fix_invitation_phone_number.sql
-- Correction du trigger handle_new_user pour ignorer la vérification du numéro de téléphone lors d'une invitation

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  new_boutique_id      uuid;
  boutique_name_val    text;
  meta_boutique_id_str text;
  phone_val            text;
BEGIN
  boutique_name_val    := NEW.raw_user_meta_data->>'boutique_name';
  meta_boutique_id_str := NEW.raw_user_meta_data->>'boutique_id';
  phone_val            := NEW.raw_user_meta_data->>'phone_number';

  -- VALIDATION OBLIGATOIRE DU NUMERO DE TELEPHONE (Sauf si c'est une invitation)
  IF NEW.raw_user_meta_data->>'invitation_id' IS NULL THEN
    IF phone_val IS NULL OR btrim(phone_val) = '' THEN
      RAISE EXCEPTION 'Le numéro de téléphone est obligatoire.';
    END IF;

    -- Regex : Autorise "+2217...", "2217..." ou juste "7..." avec 9 chiffres au total pour le numéro
    IF phone_val !~ '^(\+221|221)?7[0-9]{8}$' THEN
      RAISE EXCEPTION 'Numéro invalide — format Sénégal requis (ex: 77XXXXXXX).';
    END IF;
  END IF;

  IF boutique_name_val IS NOT NULL AND boutique_name_val != '' THEN
    -- Nouveau marchand : créer la boutique + profil gerant + plan free
    BEGIN
      new_boutique_id := meta_boutique_id_str::uuid;
    EXCEPTION WHEN OTHERS THEN
      new_boutique_id := gen_random_uuid();
    END;

    INSERT INTO public.boutiques (id, nom, gerant_id)
    VALUES (new_boutique_id, boutique_name_val, NEW.id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profils (id, role, boutique_id, phone_number)
    VALUES (NEW.id, 'gerant', new_boutique_id, phone_val)
    ON CONFLICT (id) DO NOTHING;

    -- Plan free : accès immédiat sans paywall, durée indéfinie, avec limites
    INSERT INTO public.subscriptions (
      user_id, plan, status, payment_method,
      amount, net_amount, is_trial,
      starts_at, expires_at
    )
    SELECT
      NEW.id, 'free', 'active', 'admin',
      0, 0, false,
      NOW(), '2099-12-31 23:59:59+00'::timestamptz
    WHERE NOT EXISTS (
      SELECT 1 FROM public.subscriptions WHERE user_id = NEW.id
    );

  ELSE
    -- Utilisateur invité / caissier : profil basique sans abonnement propre
    INSERT INTO public.profils (id, role, boutique_id, phone_number)
    VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'role', 'caissier'), meta_boutique_id_str::uuid, phone_val)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
