-- Migration 0034 : RPCs Signalements (Section H)
-- create_signalement / get_signalements / get_signalement_thread /
-- repondre_signalement / update_signalement_statut + trigger notification

BEGIN;

-- ══════════════════════════════════════════════════════════════
-- H19. create_signalement(user_id, boutique_id, type, sujet, message)
-- Appelée depuis l'app Sama Boutik côté utilisateur.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_signalement(
  p_boutique_id UUID,
  p_type        TEXT,
  p_sujet       TEXT,
  p_message     TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Tout utilisateur authentifié peut créer un signalement
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  IF p_type NOT IN ('bug','suggestion','plainte','autre') THEN
    RAISE EXCEPTION 'Type invalide. Valeurs acceptées : bug, suggestion, plainte, autre';
  END IF;

  IF LENGTH(TRIM(p_sujet)) < 3 THEN
    RAISE EXCEPTION 'Le sujet doit contenir au moins 3 caractères';
  END IF;

  IF LENGTH(TRIM(p_message)) < 10 THEN
    RAISE EXCEPTION 'Le message doit contenir au moins 10 caractères';
  END IF;

  INSERT INTO signalements (user_id, boutique_id, type, sujet, message)
  VALUES (auth.uid(), p_boutique_id, p_type, TRIM(p_sujet), TRIM(p_message))
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

GRANT EXECUTE ON FUNCTION public.create_signalement(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- H20. get_signalements(statut_filter, period)
-- Vue admin : liste paginable avec métadonnées
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_signalements(
  p_statut TEXT DEFAULT NULL,
  p_period TEXT DEFAULT 'all'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  PERFORM public._assert_super_admin();

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                s.id,
          'type',              s.type,
          'sujet',             s.sujet,
          'statut',            s.statut,
          'priorite',          s.priorite,
          'created_at',        s.created_at,
          'updated_at',        s.updated_at,
          'user_id',           s.user_id,
          'nom_user',          COALESCE(p.nom, split_part(u.email,'@',1)),
          'prenom_user',       p.prenom,
          'email_user',        u.email,
          'boutique_id',       s.boutique_id,
          'nom_boutique',      b.nom,
          'nb_reponses',       (
            SELECT COUNT(*) FROM signalement_reponses r
            WHERE r.signalement_id = s.id
          ),
          'dernier_message_at', (
            SELECT MAX(created_at) FROM signalement_reponses r
            WHERE r.signalement_id = s.id
          )
        )
        ORDER BY
          CASE s.priorite WHEN 'haute' THEN 0 WHEN 'normale' THEN 1 ELSE 2 END,
          CASE s.statut WHEN 'nouveau' THEN 0 WHEN 'en_cours' THEN 1 ELSE 2 END,
          s.created_at DESC
      )
      FROM signalements s
      JOIN auth.users u ON u.id = s.user_id
      LEFT JOIN profils p ON p.id = s.user_id
      LEFT JOIN boutiques b ON b.id = s.boutique_id
      WHERE (p_statut IS NULL OR s.statut = p_statut)
        AND s.created_at >= public._period_start(p_period)
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_signalements(TEXT, TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- H21. get_signalement_thread(signalement_id)
-- Message initial + toutes les réponses dans l'ordre chronologique
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_signalement_thread(p_signalement_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_caller_role TEXT;
  v_owner_id    UUID;
BEGIN
  v_caller_role := (SELECT role FROM profils WHERE id = auth.uid());

  -- Vérifier que le caller est super_admin OU le propriétaire du signalement
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
        'id',          s.id,
        'type',        s.type,
        'sujet',       s.sujet,
        'message',     s.message,
        'statut',      s.statut,
        'priorite',    s.priorite,
        'created_at',  s.created_at,
        'user_id',     s.user_id,
        'boutique_id', s.boutique_id
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

-- ══════════════════════════════════════════════════════════════
-- H22. repondre_signalement(signalement_id, message)
-- Ajoute une réponse admin, passe à 'en_cours', notifie le user
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.repondre_signalement(
  p_signalement_id UUID,
  p_message        TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reponse_id UUID;
  v_user_id    UUID;
  v_sujet      TEXT;
BEGIN
  PERFORM public._assert_super_admin();

  IF LENGTH(TRIM(p_message)) < 2 THEN
    RAISE EXCEPTION 'Le message ne peut pas être vide';
  END IF;

  -- Récupérer le user_id du signalement pour notification
  SELECT user_id, sujet INTO v_user_id, v_sujet
  FROM signalements WHERE id = p_signalement_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Signalement introuvable : %', p_signalement_id;
  END IF;

  -- Insérer la réponse admin
  INSERT INTO signalement_reponses (signalement_id, auteur_id, auteur_type, message)
  VALUES (p_signalement_id, auth.uid(), 'admin', TRIM(p_message))
  RETURNING id INTO v_reponse_id;

  -- Passer à 'en_cours' si c'était 'nouveau'
  UPDATE signalements
  SET statut = 'en_cours', updated_at = NOW()
  WHERE id = p_signalement_id AND statut = 'nouveau';

  -- Notification in-app pour l'utilisateur
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    v_user_id,
    'signalement_reponse',
    'Réponse à votre signalement',
    'L''équipe Sama Boutik a répondu à votre signalement : « ' || LEFT(v_sujet, 50) || ' »'
  );

  RETURN jsonb_build_object(
    'success',     true,
    'reponse_id',  v_reponse_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repondre_signalement(UUID, TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- H23. update_signalement_statut(signalement_id, statut)
-- Marquer manuellement un signalement (en_cours / resolu)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_signalement_statut(
  p_signalement_id UUID,
  p_statut         TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_super_admin();

  IF p_statut NOT IN ('nouveau','en_cours','resolu') THEN
    RAISE EXCEPTION 'Statut invalide. Valeurs : nouveau, en_cours, resolu';
  END IF;

  UPDATE signalements
  SET statut = p_statut, updated_at = NOW()
  WHERE id = p_signalement_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Signalement introuvable');
  END IF;

  -- Notification si résolu
  IF p_statut = 'resolu' THEN
    INSERT INTO notifications (user_id, type, title, message)
    SELECT
      s.user_id,
      'signalement_resolu',
      'Signalement résolu',
      'Votre signalement « ' || LEFT(s.sujet, 50) || ' » a été marqué comme résolu.'
    FROM signalements s WHERE s.id = p_signalement_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'statut', p_statut);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_signalement_statut(UUID, TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- H24. Trigger : badge non-lu sur notifications signalement
-- Déjà géré via la table notifications ci-dessus.
-- Le frontend peut requêter :
--   SELECT COUNT(*) FROM notifications
--   WHERE user_id = auth.uid() AND read = false
--     AND type LIKE 'signalement%'
-- ══════════════════════════════════════════════════════════════

-- RPC côté user : mes signalements avec compteur non-lu
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
