-- Migration 0054 : corrige sys_boutique_details pour les boutiques sans gérant
--
-- Bug : `IF b.gerant_id IS NOT NULL THEN SELECT ... INTO g ... END IF;` sautait
-- entièrement la requête quand gerant_id est NULL (l'état normal d'une boutique
-- juste après sa création par un Super Admin, avant que le gérant invité
-- n'accepte). La variable RECORD `g` restait alors structurellement non assignée,
-- et `g.id` plus bas levait "record "g" is not assigned yet" (55000) — exception
-- remontant jusqu'au front (AdminBoutiques.tsx, handleOpenDetails), qui l'attrape
-- silencieusement et laisse le panneau "Détails & Actions Administration" vide.
-- Reproduit en direct contre la boutique "The Legendary Drix" (gerant_id NULL).
--
-- Fix : la requête tourne désormais toujours ; sa clause WHERE p.id = b.gerant_id
-- ne matche naturellement aucune ligne quand gerant_id est NULL, ce qui assigne
-- correctement g avec des champs NULL au lieu de le laisser indéfini.

BEGIN;

CREATE OR REPLACE FUNCTION public.sys_boutique_details(boutique_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  result      JSON;
  caller_role TEXT;
  b           RECORD;
  g           RECORD;
BEGIN
  SELECT role INTO caller_role FROM public.profils WHERE id = auth.uid();
  IF COALESCE(caller_role, '') NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO b FROM public.boutiques WHERE id = boutique_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boutique introuvable: %', boutique_uuid USING ERRCODE = 'P0002';
  END IF;

  SELECT p.id, u.email, p.role
  INTO g
  FROM public.profils p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = b.gerant_id;

  SELECT json_build_object(
    'id',               b.id,
    'nom',              b.nom,
    'adresse',          b.adresse,
    'suspended',        b.suspended,
    'suspended_at',     b.suspended_at,
    'suspended_reason', b.suspended_reason,
    'created_at',       b.created_at,
    'gerant',           CASE WHEN g.id IS NOT NULL
                        THEN json_build_object('id', g.id, 'email', g.email, 'role', g.role)
                        ELSE NULL END,
    'stats',            json_build_object(
      'total_users',    (SELECT COUNT(*) FROM public.profils WHERE boutique_id = boutique_uuid),
      'total_products', (SELECT COUNT(*) FROM public.produits WHERE boutique_id = boutique_uuid AND archive = false),
      'total_sales',    (SELECT COUNT(*) FROM public.ventes WHERE boutique_id = boutique_uuid),
      'ca_total',       COALESCE((SELECT SUM(total) FROM public.ventes WHERE boutique_id = boutique_uuid), 0),
      'ca_month',       COALESCE((SELECT SUM(total) FROM public.ventes
                         WHERE boutique_id = boutique_uuid AND created_at >= NOW() - INTERVAL '30 days'), 0),
      'open_ardoises',  (SELECT COUNT(*) FROM public.ardoises
                         WHERE boutique_id = boutique_uuid AND statut = 'en_cours'),
      'ardoises_amount',COALESCE((SELECT SUM(montant_total) FROM public.ardoises
                         WHERE boutique_id = boutique_uuid AND statut = 'en_cours'), 0)
    )
  ) INTO result;

  RETURN result;
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
