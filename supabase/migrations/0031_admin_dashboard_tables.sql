-- Migration 0031 : Schéma complet Dashboard Super Admin
-- Ajoute : colonnes profils (status/nom/prenom), subscriptions (cancelled_at),
--          boutiques (quartier), tables quartiers_dakar / signalements /
--          signalement_reponses / alerts + mise à jour handle_new_user.

BEGIN;

-- ══════════════════════════════════════════════════════════════
-- 1. PROFILS — colonnes dashboard
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.profils
  ADD COLUMN IF NOT EXISTS status        TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending','active','rejected','suspended')),
  ADD COLUMN IF NOT EXISTS nom           TEXT,
  ADD COLUMN IF NOT EXISTS prenom        TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- Les super_admins et caissiers invités existants restent 'active'
-- Les nouveaux gérants seront 'pending' via le trigger mis à jour ci-dessous

-- ══════════════════════════════════════════════════════════════
-- 2. SUBSCRIPTIONS — date d'annulation explicite
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Backfill : pour les abonnements déjà annulés, utiliser updated_at
UPDATE public.subscriptions
SET cancelled_at = updated_at
WHERE status IN ('cancelled', 'trial_cancelled')
  AND cancelled_at IS NULL;

-- Trigger : renseigne cancelled_at automatiquement lors d'une annulation
CREATE OR REPLACE FUNCTION public._set_subscription_cancelled_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'trial_cancelled')
     AND OLD.status NOT IN ('cancelled', 'trial_cancelled')
     AND NEW.cancelled_at IS NULL
  THEN
    NEW.cancelled_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_cancelled_at ON public.subscriptions;
CREATE TRIGGER trg_subscription_cancelled_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public._set_subscription_cancelled_at();

-- ══════════════════════════════════════════════════════════════
-- 3. BOUTIQUES — champ quartier
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.boutiques
  ADD COLUMN IF NOT EXISTS quartier TEXT;

-- ══════════════════════════════════════════════════════════════
-- 4. TABLE QUARTIERS_DAKAR
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.quartiers_dakar (
  id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nom       TEXT          NOT NULL UNIQUE,
  latitude  NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL
);

ALTER TABLE public.quartiers_dakar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quartiers_dakar_public_read" ON public.quartiers_dakar;
CREATE POLICY "quartiers_dakar_public_read"
  ON public.quartiers_dakar FOR SELECT USING (true);

-- Seed : quartiers de Dakar et grandes villes du Sénégal
INSERT INTO public.quartiers_dakar (nom, latitude, longitude) VALUES
  -- Dakar – Plateau / Centre
  ('Plateau',              14.6937, -17.4441),
  ('Médina',               14.6892, -17.4557),
  ('Dakar Plateau',        14.6928, -17.4467),
  ('Colobane',             14.6950, -17.4571),
  ('Fass',                 14.6869, -17.4478),
  ('Gueule Tapée',         14.6932, -17.4503),
  ('Rebeuss',              14.6910, -17.4490),
  -- Dakar – Ouest
  ('Almadies',             14.7461, -17.5106),
  ('Ngor',                 14.7563, -17.5096),
  ('Ouakam',               14.7334, -17.5002),
  ('Yoff',                 14.7562, -17.4951),
  ('Mermoz',               14.7204, -17.4836),
  ('Castors',              14.7167, -17.4787),
  -- Dakar – Nord
  ('Grand Yoff',           14.7305, -17.4598),
  ('Parcelles Assainies',  14.7598, -17.4422),
  ('Sicap Liberté',        14.7053, -17.4735),
  ('Liberté 6',            14.7113, -17.4749),
  ('Point E',              14.6971, -17.4685),
  ('Fann',                 14.6892, -17.4753),
  ('Amitié',               14.7033, -17.4648),
  ('HLM',                  14.6990, -17.4601),
  ('Dieuppeul',            14.6963, -17.4637),
  ('Biscuiterie',          14.6987, -17.4470),
  ('Sacré-Cœur',           14.7094, -17.4695),
  ('Sam Notaire',          14.7440, -17.3852),
  ('Grand Dakar',          14.7131, -17.4370),
  -- Banlieue
  ('Guédiawaye',           14.7760, -17.3972),
  ('Pikine',               14.7511, -17.3975),
  ('Thiaroye',             14.7402, -17.3558),
  ('Mbao',                 14.7476, -17.3290),
  ('Keur Massar',          14.7780, -17.3222),
  ('Rufisque',             14.7158, -17.2744),
  ('Bargny',               14.7013, -17.2283),
  ('Sébikotane',           14.7360, -17.1248),
  ('Diamniadio',           14.7269, -17.1697),
  -- Grandes villes
  ('Thiès',                14.7910, -16.9256),
  ('Tivaouane',            14.9527, -16.8158),
  ('Saint-Louis',          16.0179, -16.4896),
  ('Ziguinchor',           12.5583, -16.2719),
  ('Tambacounda',          13.7709, -13.6672),
  ('Kaolack',              14.1520, -16.0750),
  ('Diourbel',             14.6562, -16.2310),
  ('Fatick',               14.3347, -16.4107),
  ('Louga',                15.6178, -16.2247),
  ('Kaffrine',             14.1059, -15.5508),
  ('Kolda',                12.8983, -14.9508),
  ('Matam',                15.6603, -13.2558),
  ('Sédhiou',              12.7079, -15.5563),
  ('Kédougou',             12.5567, -12.1864),
  ('Touba',                14.8520, -15.8770),
  ('Mbour',                14.3762, -16.9683),
  ('Joal-Fadiouth',        14.1667, -16.8333)
ON CONFLICT (nom) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 5. TABLE SIGNALEMENTS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.signalements (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boutique_id UUID        REFERENCES public.boutiques(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL CHECK (type IN ('bug','suggestion','plainte','autre')),
  sujet       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  statut      TEXT        NOT NULL DEFAULT 'nouveau'
                CHECK (statut IN ('nouveau','en_cours','resolu')),
  priorite    TEXT        NOT NULL DEFAULT 'normale'
                CHECK (priorite IN ('basse','normale','haute')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at ON public.signalements;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.signalements
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.signalements ENABLE ROW LEVEL SECURITY;

-- L'utilisateur voit uniquement ses propres signalements
DROP POLICY IF EXISTS "user_own_signalements" ON public.signalements;
CREATE POLICY "user_own_signalements"
  ON public.signalements FOR SELECT
  USING (user_id = auth.uid()
         OR (SELECT role FROM public.profils WHERE id = auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "user_create_signalement" ON public.signalements;
CREATE POLICY "user_create_signalement"
  ON public.signalements FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_update_signalement" ON public.signalements;
CREATE POLICY "admin_update_signalement"
  ON public.signalements FOR UPDATE
  USING ((SELECT role FROM public.profils WHERE id = auth.uid()) = 'super_admin');

-- ══════════════════════════════════════════════════════════════
-- 6. TABLE SIGNALEMENT_REPONSES
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.signalement_reponses (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  signalement_id UUID        NOT NULL REFERENCES public.signalements(id) ON DELETE CASCADE,
  auteur_id      UUID        NOT NULL REFERENCES auth.users(id),
  auteur_type    TEXT        NOT NULL CHECK (auteur_type IN ('user','admin')),
  message        TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.signalement_reponses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "see_own_thread_responses" ON public.signalement_reponses;
CREATE POLICY "see_own_thread_responses"
  ON public.signalement_reponses FOR SELECT
  USING (
    (SELECT role FROM public.profils WHERE id = auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.signalements s
      WHERE s.id = signalement_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "user_or_admin_can_reply" ON public.signalement_reponses;
CREATE POLICY "user_or_admin_can_reply"
  ON public.signalement_reponses FOR INSERT
  WITH CHECK (auteur_id = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- 7. TABLE ALERTS (notifications admin internes)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.alerts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  severite   TEXT        NOT NULL DEFAULT 'info'
               CHECK (severite IN ('urgent','attention','info')),
  cible_id   UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lue        BOOLEAN     NOT NULL DEFAULT false
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_see_alerts" ON public.alerts;
CREATE POLICY "super_admin_see_alerts"
  ON public.alerts FOR ALL
  USING ((SELECT role FROM public.profils WHERE id = auth.uid()) = 'super_admin')
  WITH CHECK ((SELECT role FROM public.profils WHERE id = auth.uid()) = 'super_admin');

-- ══════════════════════════════════════════════════════════════
-- 8. MISE À JOUR handle_new_user
--    – Nouveau gérant → profil.status = 'pending'
--    – Caissier invité, super_admin → 'active'
--    – Lit nom/prenom depuis les métadonnées
-- ══════════════════════════════════════════════════════════════

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
  nom_val              text;
  prenom_val           text;
  assigned_status      text;
BEGIN
  boutique_name_val    := NEW.raw_user_meta_data->>'boutique_name';
  meta_boutique_id_str := NEW.raw_user_meta_data->>'boutique_id';
  phone_val            := NEW.raw_user_meta_data->>'phone_number';
  nom_val              := NEW.raw_user_meta_data->>'nom';
  prenom_val           := NEW.raw_user_meta_data->>'prenom';

  -- Validation téléphone (sauf pour les invitations)
  IF NEW.raw_user_meta_data->>'invitation_id' IS NULL THEN
    IF phone_val IS NULL OR btrim(phone_val) = '' THEN
      RAISE EXCEPTION 'Le numéro de téléphone est obligatoire.';
    END IF;
    IF phone_val !~ '^(\+221|221)?7[0-9]{8}$' THEN
      RAISE EXCEPTION 'Numéro invalide — format Sénégal requis (ex: 77XXXXXXX).';
    END IF;
  END IF;

  IF boutique_name_val IS NOT NULL AND boutique_name_val != '' THEN
    -- Nouveau marchand : boutique + profil gerant (status=pending) + plan free
    BEGIN
      new_boutique_id := meta_boutique_id_str::uuid;
    EXCEPTION WHEN OTHERS THEN
      new_boutique_id := gen_random_uuid();
    END;

    INSERT INTO public.boutiques (id, nom, gerant_id)
    VALUES (new_boutique_id, boutique_name_val, NEW.id)
    ON CONFLICT (id) DO NOTHING;

    -- Nouveau gérant attend validation admin
    INSERT INTO public.profils (id, role, boutique_id, phone_number, nom, prenom, status)
    VALUES (NEW.id, 'gerant', new_boutique_id, phone_val, nom_val, prenom_val, 'pending')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.subscriptions (
      user_id, plan, status, payment_method,
      amount, net_amount, is_trial, starts_at, expires_at
    )
    SELECT
      NEW.id, 'free', 'active', 'admin',
      0, 0, false, NOW(), '2099-12-31 23:59:59+00'::timestamptz
    WHERE NOT EXISTS (
      SELECT 1 FROM public.subscriptions WHERE user_id = NEW.id
    );

  ELSE
    -- Caissier invité → actif immédiatement
    assigned_status := 'active';

    INSERT INTO public.profils (id, role, boutique_id, phone_number, nom, prenom, status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'role', 'caissier'),
      CASE WHEN meta_boutique_id_str IS NOT NULL
           THEN meta_boutique_id_str::uuid ELSE NULL END,
      phone_val, nom_val, prenom_val, assigned_status
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
