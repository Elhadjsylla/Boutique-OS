-- Migration 0062 : Numéro WhatsApp client sur les fiches ardoise
-- + exposition (lecture seule, un seul champ) du téléphone du Gérant
-- pour le bouton "Contacter Boutique" du portail client public.
--
-- Le portail client (PortalClient.tsx, accès via ?token=) est un VRAI accès
-- anonyme (clé anon, aucune session) : toute exposition de données doit passer
-- par une RPC SECURITY DEFINER filtrée par le token, jamais par une policy RLS
-- ouverte sur profils (0024 a déjà retiré une policy "lecture_publique_profils"
-- trop permissive — on ne rouvre pas ce trou).

BEGIN;

-- ── 1. whatsapp_numero sur ardoises (optionnel, format Sénégal) ─────────────
-- Même regex que handle_new_user()/update_phone_number() (0027/0028), pour
-- rester cohérent avec la validation déjà utilisée ailleurs dans le projet.
ALTER TABLE public.ardoises
  ADD COLUMN IF NOT EXISTS whatsapp_numero TEXT;

ALTER TABLE public.ardoises DROP CONSTRAINT IF EXISTS ardoises_whatsapp_numero_check;
ALTER TABLE public.ardoises ADD CONSTRAINT ardoises_whatsapp_numero_check
  CHECK (whatsapp_numero IS NULL OR whatsapp_numero ~ '^(\+221|221)?7[0-9]{8}$');

-- La lecture est déjà couverte par les policies SELECT existantes sur
-- ardoises (gérant + caissier de la boutique, super_admin) — aucune policy
-- supplémentaire nécessaire, whatsapp_numero est une colonne comme les autres.
-- L'INSERT (création de fiche) passe déjà par les policies INSERT existantes
-- (gérant + caissier), donc whatsapp_numero peut être renseigné dès la
-- création sans RPC dédiée.

-- ── 2. update_ardoise_whatsapp() : seule voie pour MODIFIER whatsapp_numero
--    sur une fiche déjà existante. Nécessaire car la policy UPDATE générale
--    sur ardoises est réservée au gérant (jamais accordée au caissier, voir
--    0002/0022/0057) — Postgres RLS ne restreint pas colonne par colonne,
--    donc élargir bêtement l'UPDATE au caissier lui donnerait aussi le droit
--    de modifier montant_total/statut/client_nom. Cette RPC ne touche QUE
--    whatsapp_numero, pour caissier ET gérant de la boutique concernée.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_ardoise_whatsapp(
  p_ardoise_id      UUID,
  p_whatsapp_numero TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_boutique_id UUID;
  v_normalized  TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  v_normalized := NULLIF(TRIM(COALESCE(p_whatsapp_numero, '')), '');

  IF v_normalized IS NOT NULL AND v_normalized !~ '^(\+221|221)?7[0-9]{8}$' THEN
    RAISE EXCEPTION 'Numéro invalide — format Sénégal requis (ex: 77XXXXXXX).';
  END IF;

  SELECT boutique_id INTO v_boutique_id FROM ardoises WHERE id = p_ardoise_id;

  IF v_boutique_id IS NULL THEN
    RAISE EXCEPTION 'Ardoise introuvable : %', p_ardoise_id;
  END IF;

  IF NOT (
    get_my_role() = 'super_admin'
    OR (get_my_role() IN ('gerant', 'caissier') AND v_boutique_id = get_my_boutique_id())
  ) THEN
    RAISE EXCEPTION 'Accès refusé' USING HINT = '403';
  END IF;

  UPDATE ardoises
  SET whatsapp_numero = v_normalized, updated_at = NOW()
  WHERE id = p_ardoise_id;

  RETURN jsonb_build_object('success', true, 'ardoise_id', p_ardoise_id, 'whatsapp_numero', v_normalized);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_ardoise_whatsapp(UUID, TEXT) TO authenticated;

-- ── 3. get_ardoise_by_token() : expose UNIQUEMENT le téléphone du Gérant,
--    rien d'autre du compte (pas d'email, pas de nom) — répond précisément
--    au besoin du bouton "Contacter Boutique" sans élargir l'exposition.
--    whatsapp_numero de l'ardoise elle-même est déjà inclus automatiquement
--    via row_to_json(a.*), aucun changement nécessaire pour ça.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_ardoise_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'ardoise',   row_to_json(a.*),
    'paiements', COALESCE(
      (SELECT json_agg(p ORDER BY p.paid_at DESC)
       FROM public.ardoise_paiements p
       WHERE p.ardoise_id = a.id),
      '[]'::json
    ),
    'boutique_telephone_gerant', g.phone_number
  )
  INTO v_result
  FROM public.ardoises a
  LEFT JOIN public.boutiques b ON b.id = a.boutique_id
  LEFT JOIN public.profils g ON g.id = b.gerant_id
  WHERE a.access_token = p_token;

  RETURN v_result;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
