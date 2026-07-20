-- Migration 0059 : Création de signalements par Caissier/Gérant
-- Ajoute capture_url, étend les catégories, durcit l'INSERT RLS sur boutique_id,
-- et fait dériver boutique_id/capture_url côté serveur dans create_signalement.
-- Ne touche pas aux policies SELECT/UPDATE utilisées par le Super Admin Dashboard.

BEGIN;

-- ══════════════════════════════════════════════════════════════
-- 1. Colonne capture_url (screenshot optionnel, data-URL base64 —
--    même convention que produits.image_url via ImagePicker.tsx)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.signalements
  ADD COLUMN IF NOT EXISTS capture_url TEXT;

-- ══════════════════════════════════════════════════════════════
-- 2. Étendre les catégories acceptées : bug, paiement, compte,
--    autre (+ suggestion/plainte conservées pour compat descendante)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.signalements
  DROP CONSTRAINT IF EXISTS signalements_type_check;

ALTER TABLE public.signalements
  ADD CONSTRAINT signalements_type_check
  CHECK (type IN ('bug','paiement','compte','suggestion','plainte','autre'));

-- ══════════════════════════════════════════════════════════════
-- 3. RLS INSERT : un Caissier/Gérant ne peut créer un signalement
--    que pour sa propre boutique (défense en profondeur ; le RPC
--    create_signalement dérive déjà boutique_id côté serveur).
--    SELECT/UPDATE inchangées (lecture propre signalement conservée,
--    modification réservée au Super Admin — cf. migration 0031).
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "user_create_signalement" ON public.signalements;
CREATE POLICY "user_create_signalement"
  ON public.signalements FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (boutique_id IS NULL OR boutique_id = public.get_my_boutique_id())
  );

-- ══════════════════════════════════════════════════════════════
-- 4. create_signalement : boutique_id n'est plus fourni par le
--    client (faille potentielle) mais dérivé de get_my_boutique_id().
--    Ajout du paramètre p_capture_url (optionnel).
-- ══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.create_signalement(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_signalement(
  p_type         TEXT,
  p_sujet        TEXT,
  p_message      TEXT,
  p_capture_url  TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  IF p_type NOT IN ('bug','paiement','compte','suggestion','plainte','autre') THEN
    RAISE EXCEPTION 'Type invalide. Valeurs acceptées : bug, paiement, compte, suggestion, plainte, autre';
  END IF;

  IF LENGTH(TRIM(p_sujet)) < 3 THEN
    RAISE EXCEPTION 'Le sujet doit contenir au moins 3 caractères';
  END IF;

  IF LENGTH(TRIM(p_message)) < 10 THEN
    RAISE EXCEPTION 'Le message doit contenir au moins 10 caractères';
  END IF;

  INSERT INTO signalements (user_id, boutique_id, type, sujet, message, capture_url)
  VALUES (auth.uid(), public.get_my_boutique_id(), p_type, TRIM(p_sujet), TRIM(p_message), p_capture_url)
  RETURNING id INTO v_id;

  -- Alerte automatique si type = bug ou plainte : priorité haute
  IF p_type IN ('bug', 'plainte') THEN
    UPDATE signalements SET priorite = 'haute' WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object(
    'success',        true,
    'signalement_id', v_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_signalement(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 5. Exposer capture_url en lecture (ajout additif de champ,
--    ne change ni le filtrage ni les autorisations existantes) :
--    - get_signalement_thread : lu par Super Admin ET par le
--      propriétaire du signalement (policy déjà en place)
--    - get_my_signalements : lu par le propriétaire uniquement
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_signalement_thread(p_signalement_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_caller_role TEXT;
  v_owner_id    UUID;
BEGIN
  v_caller_role := (SELECT role FROM profils WHERE id = auth.uid());

  SELECT user_id INTO v_owner_id
  FROM signalements WHERE id = p_signalement_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Signalement introuvable : %', p_signalement_id;
  END IF;

  IF v_caller_role != 'super_admin' AND v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Accès refusé' USING HINT = '403';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'signalement', jsonb_build_object(
        'id',           s.id,
        'type',         s.type,
        'sujet',        s.sujet,
        'message',      s.message,
        'statut',       s.statut,
        'priorite',     s.priorite,
        'created_at',   s.created_at,
        'user_id',      s.user_id,
        'boutique_id',  s.boutique_id,
        'capture_url',  s.capture_url
      ),
      'reponses', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',          r.id,
              'auteur_id',   r.auteur_id,
              'auteur_type', r.auteur_type,
              'nom_auteur',  COALESCE(p.nom, split_part(u.email,'@',1)),
              'message',     r.message,
              'created_at',  r.created_at
            )
            ORDER BY r.created_at ASC
          )
          FROM signalement_reponses r
          JOIN auth.users u ON u.id = r.auteur_id
          LEFT JOIN profils p ON p.id = r.auteur_id
          WHERE r.signalement_id = s.id
        ),
        '[]'::jsonb
      )
    )
    FROM signalements s
    WHERE s.id = p_signalement_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_signalement_thread(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_signalements()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  RETURN jsonb_build_object(
    'signalements', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',            s.id,
            'type',          s.type,
            'sujet',         s.sujet,
            'statut',        s.statut,
            'priorite',      s.priorite,
            'created_at',    s.created_at,
            'capture_url',   s.capture_url,
            'nb_reponses',   (SELECT COUNT(*) FROM signalement_reponses r WHERE r.signalement_id = s.id),
            'non_lu',        (
              SELECT COUNT(*) FROM signalement_reponses r
              WHERE r.signalement_id = s.id
                AND r.auteur_type = 'admin'
                AND r.created_at > COALESCE(
                  (SELECT MAX(r2.created_at) FROM signalement_reponses r2
                   WHERE r2.signalement_id = s.id AND r2.auteur_type = 'user'),
                  s.created_at
                )
            )
          )
          ORDER BY s.created_at DESC
        )
        FROM signalements s
        WHERE s.user_id = auth.uid()
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_signalements() TO authenticated;

COMMIT;
