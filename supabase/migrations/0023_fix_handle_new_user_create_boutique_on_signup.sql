-- Fix handle_new_user: properly create boutique for new merchants
-- and give them a 7-day trial instead of blanket super_admin access
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  new_boutique_id      uuid;
  boutique_name_val    text;
  meta_boutique_id_str text;
BEGIN
  boutique_name_val     := NEW.raw_user_meta_data->>'boutique_name';
  meta_boutique_id_str  := NEW.raw_user_meta_data->>'boutique_id';

  IF boutique_name_val IS NOT NULL AND boutique_name_val != '' THEN
    -- New merchant signup: use the UUID from user_metadata if valid,
    -- otherwise generate a fresh one.
    BEGIN
      new_boutique_id := meta_boutique_id_str::uuid;
    EXCEPTION WHEN OTHERS THEN
      new_boutique_id := gen_random_uuid();
    END;

    -- Create the boutique
    INSERT INTO public.boutiques (id, nom, gerant_id)
    VALUES (new_boutique_id, boutique_name_val, NEW.id)
    ON CONFLICT (id) DO NOTHING;

    -- Create the profil as gerant of their new boutique
    INSERT INTO public.profils (id, role, boutique_id)
    VALUES (NEW.id, 'gerant', new_boutique_id)
    ON CONFLICT (id) DO NOTHING;

    -- 7-day free trial subscription
    INSERT INTO public.subscriptions (
      user_id, plan, status, payment_method,
      amount, net_amount, is_trial,
      starts_at, expires_at, cancellation_deadline
    )
    VALUES (
      NEW.id, 'starter', 'trial', 'admin',
      0, 0, true,
      NOW(), NOW() + INTERVAL '7 days', NOW() + INTERVAL '24 hours'
    )
    ON CONFLICT DO NOTHING;

  ELSE
    -- Invited user or no boutique context: basic caissier profile
    INSERT INTO public.profils (id, role, boutique_id)
    VALUES (NEW.id, 'caissier', NULL)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
